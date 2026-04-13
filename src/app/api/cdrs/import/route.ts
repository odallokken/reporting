import { NextRequest, NextResponse } from 'next/server'
import { createPrivateKey, createSign, randomUUID } from 'crypto'
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

type AuthContext =
  | { type: 'basic'; username: string; password: string }
  | { type: 'oauth2'; clientId: string; privateKey: string; accessToken?: string }

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createClientAssertionJwt(clientId: string, tokenUrl: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', typ: 'JWT' }
  const payload = {
    sub: clientId,
    iss: clientId,
    aud: tokenUrl,
    iat: now,
    exp: now + 3600,
    jti: randomUUID()
  }

  const encodedHeader = toBase64Url(JSON.stringify(header))
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const sign = createSign('SHA256')
  sign.update(signingInput)
  sign.end()
  const signature = sign.sign({
    key: createPrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363'
  })

  return `${signingInput}.${toBase64Url(signature)}`
}

async function fetchOAuthAccessToken(baseOrigin: string, clientId: string, privateKey: string) {
  const tokenUrl = new URL('/oauth/token/', baseOrigin).toString()
  const clientAssertion = createClientAssertionJwt(clientId, tokenUrl, privateKey)

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
    scope: 'is_admin use_api'
  })

  await log('info', `Requesting OAuth2 token from ${tokenUrl}`, { source: LOG_SOURCE })
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: body.toString(),
    cache: 'no-store'
  })

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text().catch(() => '')
    throw new Error(
      `OAuth2 token request failed with HTTP ${tokenResponse.status}. ${errorBody.slice(0, 500)}`
    )
  }

  const tokenData = await tokenResponse.json() as { access_token?: string }
  if (!tokenData.access_token) {
    throw new Error('OAuth2 token response did not include access_token')
  }

  return tokenData.access_token
}

async function fetchWithAuth(
  url: string,
  auth: AuthContext,
  baseOrigin: string
): Promise<Response> {
  await log('info', `Fetching ${url} with ${auth.type === 'basic' ? 'Basic' : 'OAuth2'} auth`, {
    source: LOG_SOURCE
  })

  if (auth.type === 'basic') {
    const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
      cache: 'no-store'
    })

    await log(response.ok ? 'info' : 'error', `Response: HTTP ${response.status}`, {
      source: LOG_SOURCE,
      details: response.ok
        ? `Request successful (final URL: ${response.url})`
        : `Status: ${response.status} ${response.statusText}\nFinal URL: ${response.url}`
    })
    return response
  }

  if (!auth.accessToken) {
    auth.accessToken = await fetchOAuthAccessToken(baseOrigin, auth.clientId, auth.privateKey)
  }

  let response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: 'no-store'
  })

  if (response.status === 401) {
    auth.accessToken = await fetchOAuthAccessToken(baseOrigin, auth.clientId, auth.privateKey)
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: 'no-store'
    })
  }

  await log(response.ok ? 'info' : 'error', `Response: HTTP ${response.status}`, {
    source: LOG_SOURCE,
    details: response.ok
      ? `Request successful (final URL: ${response.url})`
      : `Status: ${response.status} ${response.statusText}\nFinal URL: ${response.url}`
  })
  return response
}

function buildManagementApiUrl(baseUrl: string) {
  const parsedUrl = new URL(baseUrl)
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('URL must use HTTPS')
  }
  // Warn early if the user accidentally included /admin or another path.
  // The Pexip docs state: enter the base URL only (e.g. https://pexip.example.com).
  if (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
    throw new Error(`URL should not contain a path (got "${parsedUrl.pathname}"). Use the base Management Node URL only, e.g. https://pexip.example.com`)
  }
  return new URL('/api/admin/history/v1/conference/', parsedUrl.origin).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      baseUrl: string
      authType?: 'basic' | 'oauth2'
      username?: string
      password?: string
      clientId?: string
      privateKey?: string
    }
    const { baseUrl, authType: incomingAuthType, username, password, clientId, privateKey } = body
    const authType = incomingAuthType ?? (clientId && privateKey ? 'oauth2' : 'basic')

    if (!baseUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (authType === 'basic' && (!username || !password)) {
      return NextResponse.json({ error: 'Missing Basic auth credentials' }, { status: 400 })
    }
    if (authType === 'oauth2' && (!clientId || !privateKey)) {
      return NextResponse.json({ error: 'Missing OAuth2 credentials' }, { status: 400 })
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
    const auth: AuthContext = authType === 'oauth2'
      ? { type: 'oauth2', clientId: String(clientId), privateKey: String(privateKey) }
      : { type: 'basic', username: String(username), password: String(password) }

    await log('info', `Starting CDR import from ${url}`, {
      source: LOG_SOURCE,
      details: authType === 'oauth2'
        ? `Auth: OAuth2 client ${clientId}`
        : `Auth: Basic user ${username}`
    })

    let response: Response
    try {
      response = await fetchWithAuth(url, auth, baseOrigin)
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
        guidance = authType === 'oauth2'
          ? ' Check your OAuth2 Client ID and Private Key, and confirm the OAuth2 client role includes the required API permissions.'
          : ' Check that you are using the correct username and password for a Pexip Management API account.'
        const wwwAuth = response.headers.get('www-authenticate') ?? 'N/A'
        details += `\nWWW-Authenticate: ${wwwAuth}`
        // If Bearer is listed in the challenge, the server has OAuth2 configured.
        // Basic auth might be disabled — mention this to help users troubleshoot.
        if (wwwAuth.includes('Bearer') && authType === 'basic') {
          guidance += ' If Basic auth is disabled, use OAuth2 client authentication (Client ID + Private Key) instead.'
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
        : await fetchWithAuth(nextUrl, auth, baseOrigin)

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
              const partResponse = await fetchWithAuth(partNextUrl, auth, baseOrigin)
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
