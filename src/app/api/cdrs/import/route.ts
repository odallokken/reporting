import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/logger'

const LOG_SOURCE = 'cdr-import'

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
  const regex = /(\w+)=(?:"([^"]*)"|([\w.+-]+))/g
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
  const { realm, nonce, qop: rawQop, opaque, algorithm } = challenge
  const algo = (algorithm ?? 'MD5').toUpperCase()
  const cnonce = randomBytes(8).toString('hex')
  // nc is always 1 because we use a fresh nonce per request
  const nc = '00000001'
  // Select the first qop value when the server offers multiple (e.g. "auth,auth-int")
  const qop = rawQop?.split(',')[0].trim()

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
): Promise<{ response: Response; authScheme: string }> {
  // Send an unauthenticated request first to obtain the server's auth challenge.
  // Sending Basic credentials up-front can cause some Pexip nodes to reject the
  // request without returning a Digest challenge, resulting in an unexplained 401.
  await log('info', `Sending initial unauthenticated request to ${url}`, { source: LOG_SOURCE })

  const firstResponse = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
    cache: 'no-store'
  })

  await log('info', `Initial response: HTTP ${firstResponse.status}`, {
    source: LOG_SOURCE,
    details: `Status: ${firstResponse.status} ${firstResponse.statusText}\nContent-Type: ${firstResponse.headers.get('content-type') ?? 'N/A'}\nWWW-Authenticate: ${firstResponse.headers.get('www-authenticate') ?? 'N/A'}`
  })

  if (firstResponse.status !== 401) {
    return { response: firstResponse, authScheme: 'none' }
  }

  // Inspect the WWW-Authenticate header to decide which scheme to use
  const wwwAuth = firstResponse.headers.get('www-authenticate') ?? ''

  if (wwwAuth.toLowerCase().includes('digest')) {
    await log('info', 'Server requires Digest authentication, computing response...', { source: LOG_SOURCE })
    // Extract the Digest challenge (it may follow other schemes in the header)
    const digestStart = wwwAuth.toLowerCase().indexOf('digest')
    const digestChallenge = wwwAuth.slice(digestStart)
    const challenge = parseDigestChallenge(digestChallenge)
    await log('info', 'Parsed Digest challenge', {
      source: LOG_SOURCE,
      details: `realm="${challenge.realm}", nonce="${challenge.nonce}", qop="${challenge.qop ?? 'N/A'}", algorithm="${challenge.algorithm ?? 'MD5'}", opaque="${challenge.opaque ?? 'N/A'}"`
    })

    const parsedUrl = new URL(url)
    const uri = parsedUrl.pathname + parsedUrl.search
    const authHeader = buildDigestAuthHeader(username, password, 'GET', uri, challenge)

    const authResponse = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: authHeader
      },
      redirect: 'manual',
      cache: 'no-store'
    })

    await log(
      authResponse.ok ? 'info' : 'error',
      `Digest auth response: HTTP ${authResponse.status}`,
      {
        source: LOG_SOURCE,
        details: authResponse.ok
          ? `Authentication successful`
          : `Status: ${authResponse.status} ${authResponse.statusText}\nWWW-Authenticate: ${authResponse.headers.get('www-authenticate') ?? 'N/A'}\nContent-Type: ${authResponse.headers.get('content-type') ?? 'N/A'}`
      }
    )

    return { response: authResponse, authScheme: 'digest' }
  }

  if (wwwAuth.toLowerCase().includes('basic')) {
    await log('info', 'Server requires Basic authentication, sending credentials...', { source: LOG_SOURCE })
    // Fall back to Basic authentication when the server requests it
    const basicCredentials = Buffer.from(`${username}:${password}`).toString('base64')
    const authResponse = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${basicCredentials}`
      },
      redirect: 'manual',
      cache: 'no-store'
    })

    await log(
      authResponse.ok ? 'info' : 'error',
      `Basic auth response: HTTP ${authResponse.status}`,
      {
        source: LOG_SOURCE,
        details: authResponse.ok
          ? `Authentication successful`
          : `Status: ${authResponse.status} ${authResponse.statusText}`
      }
    )

    return { response: authResponse, authScheme: 'basic' }
  }

  await log('warn', 'No recognized authentication scheme in WWW-Authenticate header', {
    source: LOG_SOURCE,
    details: `WWW-Authenticate: ${wwwAuth}`
  })
  // No recognized authentication scheme; return the original 401
  return { response: firstResponse, authScheme: 'unknown' }
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
      await log('error', 'Invalid Management Node URL', { source: LOG_SOURCE, details: `Provided URL: ${baseUrl}` })
      return NextResponse.json({
        error: 'Invalid Management Node URL. Please enter the HTTPS Management Node base URL, for example https://pexip.example.com'
      }, { status: 400 })
    }

    await log('info', `Starting CDR import from ${url}`, { source: LOG_SOURCE, details: `User: ${username}` })

    let response: Response
    let authScheme: string
    try {
      const result = await fetchWithDigestAuth(url, username, password)
      response = result.response
      authScheme = result.authScheme
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await log('error', 'Network error contacting Pexip Management Node', { source: LOG_SOURCE, details: message })
      return NextResponse.json({
        error: `Could not reach the Management Node at ${baseUrl}. ${message}`
      }, { status: 502 })
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await log('warn', `Pexip redirected request (HTTP ${response.status})`, { source: LOG_SOURCE, details: `Location: ${location ?? 'N/A'}` })
      return NextResponse.json({
        error: location
          ? `Pexip redirected the request to ${location}. Use the direct Management Node URL without /admin or any other path.`
          : 'Pexip redirected the request. Use the direct Management Node URL without /admin or any other path.'
      }, { status: 502 })
    }

    if (!response.ok) {
      let guidance = ''
      let details = `HTTP ${response.status} ${response.statusText}\nAuth scheme used: ${authScheme}`

      if (response.status === 401 || response.status === 403) {
        guidance = ' Check that you are using the correct username and password for a Pexip Management API account.'
        details += `\nWWW-Authenticate: ${response.headers.get('www-authenticate') ?? 'N/A'}`
        // Try to read response body for additional clues
        try {
          const errorBody = await response.text()
          if (errorBody) details += `\nResponse body: ${errorBody.slice(0, 500)}`
        } catch {
          // ignore
        }
      }

      await log('error', `Pexip API returned ${response.status}`, { source: LOG_SOURCE, details })
      return NextResponse.json({ error: `Pexip API returned ${response.status}.${guidance}` }, { status: 502 })
    }

    // Fetch all pages — the Pexip API paginates results via meta.next
    const conferences: PexipCDRConference[] = []
    let nextUrl: string | null = url

    while (nextUrl) {
      const pageResponse = nextUrl === url
        ? response
        : (await fetchWithDigestAuth(nextUrl, username, password)).response

      if (!pageResponse.ok) {
        await log('warn', `Pexip API returned ${pageResponse.status} while fetching page`, { source: LOG_SOURCE, details: `URL: ${nextUrl}` })
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

    await log('info', `Fetched ${conferences.length} conferences from Pexip API`, { source: LOG_SOURCE })

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
        const errMessage = err instanceof Error ? err.message : String(err)
        await log('warn', `Failed to import conference: ${conf.call_id ?? conf.name ?? 'unknown'}`, { source: LOG_SOURCE, details: errMessage })
        skipped++
      }
    }

    await log('info', `CDR import complete: ${imported} imported, ${skipped} skipped`, { source: LOG_SOURCE })

    return NextResponse.json({ imported, skipped, total: conferences.length })
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    await log('error', 'CDR import failed with unexpected error', { source: LOG_SOURCE, details: errMessage })
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
