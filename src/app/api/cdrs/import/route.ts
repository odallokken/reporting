import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

interface PexipCDRConference {
  id?: number
  name?: string
  start_time?: string
  end_time?: string
  call_id?: string
  participants?: PexipCDRParticipant[]
}

interface PexipCDRParticipant {
  display_name?: string
  call_uuid?: string
  connect_time?: string
  disconnect_time?: string
}

function md5(data: string): string {
  return createHash('md5').update(data).digest('hex')
}

function parseDigestChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {}
  const digestPrefix = 'Digest '
  const raw = header.startsWith(digestPrefix) ? header.slice(digestPrefix.length) : header
  const regex = /(\w+)=(?:"([^"]*)"|([\w]+))/g
  let match
  while ((match = regex.exec(raw)) !== null) {
    params[match[1]] = match[2] ?? match[3]
  }
  return params
}

function buildDigestAuthHeader(
  username: string,
  password: string,
  method: string,
  uri: string,
  challenge: Record<string, string>
): string {
  const { realm, nonce, qop, opaque, algorithm } = challenge
  const algo = (algorithm ?? 'MD5').toUpperCase()
  const cnonce = randomBytes(8).toString('hex')
  // nc is always 1 because we use a fresh nonce per request
  const nc = '00000001'

  const ha1 = algo === 'MD5-SESS'
    ? md5(`${md5(`${username}:${realm}:${password}`)}:${nonce}:${cnonce}`)
    : md5(`${username}:${realm}:${password}`)

  const ha2 = md5(`${method}:${uri}`)

  let response: string
  if (qop) {
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`)
  }

  let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`
  if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`
  if (opaque) header += `, opaque="${opaque}"`
  if (algorithm) header += `, algorithm=${algorithm}`
  return header
}

async function fetchWithDigestAuth(
  url: string,
  username: string,
  password: string
): Promise<Response> {
  // First attempt with Basic auth — some Pexip setups accept it
  const basicCredentials = Buffer.from(`${username}:${password}`).toString('base64')
  const firstResponse = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicCredentials}`
    },
    redirect: 'manual'
  })

  if (firstResponse.status !== 401) {
    return firstResponse
  }

  // Check if server requests Digest authentication
  const wwwAuth = firstResponse.headers.get('www-authenticate') ?? ''
  if (!wwwAuth.toLowerCase().startsWith('digest')) {
    return firstResponse
  }

  // Retry with Digest authentication
  const challenge = parseDigestChallenge(wwwAuth)
  const parsedUrl = new URL(url)
  const uri = parsedUrl.pathname + parsedUrl.search
  const authHeader = buildDigestAuthHeader(username, password, 'GET', uri, challenge)

  return fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: authHeader
    },
    redirect: 'manual'
  })
}

function buildManagementApiUrl(baseUrl: string) {
  const parsedUrl = new URL(baseUrl)
  return new URL('/api/admin/history/v1/conference/', parsedUrl.origin).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { baseUrl: string; username: string; password: string }
    const { baseUrl, username, password } = body

    if (!baseUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let url: string
    try {
      url = buildManagementApiUrl(baseUrl)
    } catch {
      return NextResponse.json({
        error: 'Invalid Management Node URL. Please enter the HTTPS Management Node base URL, for example https://pexip.example.com'
      }, { status: 400 })
    }

    const response = await fetchWithDigestAuth(url, username, password)

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      return NextResponse.json({
        error: location
          ? `Pexip redirected the request to ${location}. Use the direct Management Node URL without /admin or any other path.`
          : 'Pexip redirected the request. Use the direct Management Node URL without /admin or any other path.'
      }, { status: 502 })
    }

    if (!response.ok) {
      const guidance = response.status === 401 || response.status === 403
        ? ' Check that you are using the correct username and password for a Pexip Management API account.'
        : ''
      return NextResponse.json({ error: `Pexip API returned ${response.status}.${guidance}` }, { status: 502 })
    }

    // Fetch all pages — the Pexip API paginates results via meta.next
    const conferences: PexipCDRConference[] = []
    let nextUrl: string | null = url

    while (nextUrl) {
      const pageResponse = nextUrl === url
        ? response
        : await fetchWithDigestAuth(nextUrl, username, password)

      if (!pageResponse.ok) {
        console.warn(`Pexip API returned ${pageResponse.status} while fetching page: ${nextUrl}`)
        break
      }

      const pageData = await pageResponse.json() as {
        meta?: { next?: string | null }
        objects?: PexipCDRConference[]
      }

      if (pageData.objects) {
        conferences.push(...pageData.objects)
      }

      const nextPath = pageData.meta?.next
      if (nextPath) {
        const base = new URL(url)
        nextUrl = new URL(nextPath, base.origin).toString()
      } else {
        nextUrl = null
      }
    }

    let imported = 0
    let skipped = 0

    for (const conf of conferences) {
      try {
        const vmrName = conf.name ?? 'Unknown'
        const startTime = conf.start_time ? new Date(conf.start_time) : null
        const vmr = await prisma.vMR.upsert({
          where: { name: vmrName },
          update: startTime ? { lastUsedAt: startTime } : {},
          create: { name: vmrName, lastUsedAt: startTime }
        })

        const conference = await prisma.conference.create({
          data: {
            vmrId: vmr.id,
            startTime: conf.start_time ? new Date(conf.start_time) : new Date(),
            endTime: conf.end_time ? new Date(conf.end_time) : null,
            callId: conf.call_id ?? null
          }
        })

        if (conf.participants) {
          for (const p of conf.participants) {
            await prisma.participant.create({
              data: {
                conferenceId: conference.id,
                name: p.display_name ?? null,
                callUuid: p.call_uuid ?? null,
                joinTime: p.connect_time ? new Date(p.connect_time) : new Date(),
                leaveTime: p.disconnect_time ? new Date(p.disconnect_time) : null
              }
            })
          }
        }
        imported++
      } catch (err) {
        console.error('Failed to import conference:', conf.call_id ?? conf.name, err)
        skipped++
      }
    }

    return NextResponse.json({ imported, skipped, total: conferences.length })
  } catch (error) {
    console.error('CDR import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
