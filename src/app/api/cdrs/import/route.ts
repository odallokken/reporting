import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/logger'

const LOG_SOURCE = 'cdr-import'

interface PexipCDRConference {
  id?: string
  name?: string
  start_time?: string
  end_time?: string
  call_id?: string
  // The Pexip API returns participants as URI strings, not inline objects
  participants?: string[]
}

interface PexipCDRParticipant {
  display_name?: string
  call_uuid?: string
  connect_time?: string
  disconnect_time?: string
}

import * as https from 'https'

async function fetchWithBasicAuth(
  url: string,
  username: string,
  password: string
): Promise<Response> {
  await log('info', `Fetching ${url} with native https and Basic auth`, {
    source: LOG_SOURCE,
  })

  const credentials = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }, (res) => {
      // If we encounter a redirect, natively handle it (up to 3 times)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString()
        resolve(fetchWithBasicAuth(redirectUrl, username, password))
        return
      }

      const chunks: Buffer[] = []
      res.on('data', d => chunks.push(d))
      res.on('end', async () => {
        const bodyBuffer = Buffer.concat(chunks)
        const textStr = bodyBuffer.toString('utf8')
        
        const isOk = res.statusCode! >= 200 && res.statusCode! < 300
        
        await log(isOk ? 'info' : 'error', `Response: HTTP ${res.statusCode}`, {
          source: LOG_SOURCE,
          details: isOk
            ? `Request successful (final URL: ${url})`
            : `Status: ${res.statusCode} ${res.statusMessage}\nFinal URL: ${url}`
        })

        // Return a polyfilled fetch-like Response object
        resolve({
          ok: isOk,
          status: res.statusCode!,
          statusText: res.statusMessage || '',
          url: url,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          headers: new Headers(res.headers as any),
          text: async () => textStr,
          json: async () => JSON.parse(textStr)
        } as unknown as Response)
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function buildManagementApiUrl(baseUrl: string) {
  const parsedUrl = new URL(baseUrl)
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('URL must use HTTPS')
  }
  // Warn early if the user accidentally included /admin or another path.
  if (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
    throw new Error(`URL should not contain a path (got "${parsedUrl.pathname}"). Use the base Management Node URL only, e.g. https://pexip.example.com`)
  }
  return new URL('/api/admin/history/v1/conference/', parsedUrl.origin).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { baseUrl: string; username: string; password: string; minDurationSeconds?: number }
    const baseUrl = body.baseUrl?.trim()
    const username = body.username?.trim()
    const password = body.password ?? ''
    const minDurationSeconds = typeof body.minDurationSeconds === 'number' && body.minDurationSeconds > 0 ? body.minDurationSeconds : 0

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

    const baseOrigin = new URL(url).origin
    await log('info', `Starting CDR import from ${url}`, {
      source: LOG_SOURCE,
      details: `Auth: Basic user ${username}`
    })

    let response: Response
    try {
      response = await fetchWithBasicAuth(url, username, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await log('error', 'Network error contacting Pexip Management Node', { source: LOG_SOURCE, details: message })
      return NextResponse.json({
        error: `Could not reach the Management Node at ${baseUrl}. ${message}`
      }, { status: 502 })
    }

    if (!response.ok) {
      let guidance = ''
      let details = `HTTP ${response.status} ${response.statusText}`

      if (response.status === 401 || response.status === 403) {
        guidance = ' Check that you are using the correct username and password for a Pexip Management API account.'
        const wwwAuth = response.headers.get('www-authenticate') ?? 'N/A'
        details += `\nWWW-Authenticate: ${wwwAuth}`
        if (wwwAuth.includes('Bearer')) {
          guidance += ' If your Management Node has OAuth2 enabled, ensure that "Disable Basic authentication" is NOT selected under Administrator Authentication settings.'
        }
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

    // Fetch all conference pages — the Pexip API paginates results via meta.next
    const conferences: PexipCDRConference[] = []
    let nextUrl: string | null = url

    while (nextUrl) {
      const pageResponse = nextUrl === url
        ? response
        : await fetchWithBasicAuth(nextUrl, username, password)

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
        // Enforce baseOrigin to prevent absolute HTTP URLs from reverse proxies breaking the auth headers
        const parsedNext = new URL(nextPath, baseOrigin)
        const enforcedNext = new URL(parsedNext.pathname + parsedNext.search, baseOrigin)
        nextUrl = enforcedNext.toString()
      } else {
        nextUrl = null
      }
    }

    await log('info', `Fetched ${conferences.length} conferences from Pexip API`, { source: LOG_SOURCE })

    let imported = 0
    let skipped = 0

    for (const conf of conferences) {
      try {
        // Skip conferences with duration less than threshold to filter out SIP scanner calls
        if (minDurationSeconds > 0 && conf.start_time && conf.end_time) {
          const durationSeconds = (new Date(conf.end_time).getTime() - new Date(conf.start_time).getTime()) / 1000
          if (durationSeconds < minDurationSeconds) {
            skipped++
            continue
          }
        }

        const vmrName = conf.name ?? 'Unknown'
        const startTime = conf.start_time ? new Date(conf.start_time) : null
        const existingVmr = await prisma.vMR.findUnique({ where: { name: vmrName } })
        let vmr
        if (existingVmr) {
          if (startTime && (!existingVmr.lastUsedAt || startTime > existingVmr.lastUsedAt)) {
            vmr = await prisma.vMR.update({
              where: { name: vmrName },
              data: { lastUsedAt: startTime }
            })
          } else {
            vmr = existingVmr
          }
        } else {
          vmr = await prisma.vMR.create({
            data: { name: vmrName, lastUsedAt: startTime }
          })
        }

        const conference = await prisma.conference.create({
          data: {
            vmrId: vmr.id,
            startTime: conf.start_time ? new Date(conf.start_time) : new Date(),
            endTime: conf.end_time ? new Date(conf.end_time) : null,
            callId: conf.call_id ?? null
          }
        })

        if (conf.id) {
          const participantUrl = new URL(`/api/admin/history/v1/participant/`, baseOrigin)
          participantUrl.searchParams.set('conference', String(conf.id))
          let partNextUrl: string | null = participantUrl.toString()

          while (partNextUrl) {
            try {
              const partResponse = await fetchWithBasicAuth(partNextUrl, username, password)
              if (!partResponse.ok) {
                await log('warn', `Failed to fetch participants for conference ${conf.id}: HTTP ${partResponse.status}`, { source: LOG_SOURCE })
                break
              }

              const partData = await partResponse.json() as {
                meta?: { next?: string | null }
                objects?: PexipCDRParticipant[]
              }

              if (partData.objects) {
                for (const p of partData.objects) {
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

              const nextPartPath = partData.meta?.next
              if (nextPartPath) {
                // Enforce baseOrigin to prevent absolute HTTP URLs from reverse proxies
                const parsedNextPart = new URL(nextPartPath, baseOrigin)
                const enforcedNextPart = new URL(parsedNextPart.pathname + parsedNextPart.search, baseOrigin)
                partNextUrl = enforcedNextPart.toString()
              } else {
                partNextUrl = null
              }
            } catch (partErr) {
              const msg = partErr instanceof Error ? partErr.message : String(partErr)
              await log('warn', `Error fetching participants for conference ${conf.id}`, { source: LOG_SOURCE, details: msg })
              break
            }
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
