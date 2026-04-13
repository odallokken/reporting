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

function buildBasicAuthHeaders(username: string, password: string): Record<string, string> {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  return {
    Accept: 'application/json',
    Authorization: `Basic ${credentials}`
  }
}

async function fetchWithBasicAuth(
  url: string,
  username: string,
  password: string
): Promise<Response> {
  // Pexip uses HTTP Basic Authentication over HTTPS (per docs.pexip.com).
  // Send credentials preemptively — no unauthenticated round-trip needed.
  await log('info', `Fetching ${url} with Basic auth`, { source: LOG_SOURCE })

  const response = await fetch(url, {
    headers: buildBasicAuthHeaders(username, password),
    redirect: 'manual',
    cache: 'no-store'
  })

  await log(
    response.ok ? 'info' : 'error',
    `Response: HTTP ${response.status}`,
    {
      source: LOG_SOURCE,
      details: response.ok
        ? 'Request successful'
        : `Status: ${response.status} ${response.statusText}`
    }
  )

  return response
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
    try {
      response = await fetchWithBasicAuth(url, username, password)
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
      let details = `HTTP ${response.status} ${response.statusText}`

      if (response.status === 401 || response.status === 403) {
        guidance = ' Check that you are using the correct username and password for a Pexip Management API account.'
        details += `\nWWW-Authenticate: ${response.headers.get('www-authenticate') ?? 'N/A'}`
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
    const baseOrigin = new URL(url).origin
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
      nextUrl = nextPath ? new URL(nextPath, baseOrigin).toString() : null
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

        // Fetch participants for this conference from the participant history endpoint.
        // The conference object only contains participant URI strings, not inline data.
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
              partNextUrl = nextPartPath ? new URL(nextPartPath, baseOrigin).toString() : null
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
