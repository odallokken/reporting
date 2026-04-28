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
  protocol?: string
  vendor?: string
  call_direction?: string
  encryption?: string
  source_alias?: string
  destination_alias?: string
  remote_address?: string
  media_node?: string
  signalling_node?: string
  disconnect_reason?: string
  role?: string
  rx_bandwidth?: number
  tx_bandwidth?: number
  service_tag?: string
  conversation_id?: string
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
        const endTime = conf.end_time ? new Date(conf.end_time) : null
        const historyId = conf.id ? String(conf.id) : null
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

        const conference = await upsertHistoricalConference({
          vmrId: vmr.id,
          historyId,
          callId: conf.call_id ?? null,
          startTime: startTime ?? new Date(),
          endTime,
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
                  await upsertHistoricalParticipant(
                    conference.id,
                    {
                      name: p.display_name ?? null,
                      callUuid: p.call_uuid ?? null,
                      joinTime: p.connect_time ? new Date(p.connect_time) : conference.startTime,
                      leaveTime: p.disconnect_time ? new Date(p.disconnect_time) : conference.endTime,
                      protocol: p.protocol ?? null,
                      vendor: p.vendor ?? null,
                      callDirection: p.call_direction ?? null,
                      encryption: p.encryption ?? null,
                      sourceAlias: p.source_alias ?? null,
                      destinationAlias: p.destination_alias ?? null,
                      remoteAddress: p.remote_address ?? null,
                      mediaNode: p.media_node ?? null,
                      signallingNode: p.signalling_node ?? null,
                      disconnectReason: p.disconnect_reason ?? null,
                      role: p.role ?? null,
                      rxBandwidth: typeof p.rx_bandwidth === 'number' ? p.rx_bandwidth : null,
                      txBandwidth: typeof p.tx_bandwidth === 'number' ? p.tx_bandwidth : null,
                      identity: p.service_tag ?? p.conversation_id ?? null,
                    }
                  )
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

async function upsertHistoricalConference({
  vmrId,
  historyId,
  callId,
  startTime,
  endTime,
}: {
  vmrId: number
  historyId: string | null
  callId: string | null
  startTime: Date
  endTime: Date | null
}) {
  const existingConferenceByHistoryId = historyId
    ? await prisma.conference.findUnique({ where: { historyId } })
    : null
  const existingConferenceByCallId = !existingConferenceByHistoryId && callId
    ? await prisma.conference.findUnique({ where: { callId } })
    : null
  const existingConferenceByWindow = !existingConferenceByHistoryId && !existingConferenceByCallId
    ? await prisma.conference.findFirst({
        where: {
          vmrId,
          startTime,
          endTime,
          callId: null,
        },
      })
    : null
  const existingConference = existingConferenceByHistoryId ?? existingConferenceByCallId ?? existingConferenceByWindow

  if (!existingConference) {
    return prisma.conference.create({
      data: {
        vmrId,
        historyId,
        startTime,
        endTime,
        callId,
      },
    })
  }

  return prisma.conference.update({
    where: { id: existingConference.id },
    data: {
      historyId: historyId ?? existingConference.historyId,
      callId: callId ?? existingConference.callId,
      startTime,
      endTime: endTime ?? existingConference.endTime,
    },
  })
}

async function upsertHistoricalParticipant(
  conferenceId: number,
  participant: {
    name: string | null
    callUuid: string | null
    joinTime: Date
    leaveTime: Date | null
    protocol?: string | null
    vendor?: string | null
    callDirection?: string | null
    encryption?: string | null
    sourceAlias?: string | null
    destinationAlias?: string | null
    remoteAddress?: string | null
    mediaNode?: string | null
    signallingNode?: string | null
    disconnectReason?: string | null
    role?: string | null
    rxBandwidth?: number | null
    txBandwidth?: number | null
    identity?: string | null
  },
) {
  const duration = participant.leaveTime
    ? Math.max(0, (participant.leaveTime.getTime() - participant.joinTime.getTime()) / 1000)
    : null

  const existingParticipant = participant.callUuid
    ? await prisma.participant.findUnique({ where: { callUuid: participant.callUuid } })
    : await prisma.participant.findFirst({
        where: {
          conferenceId,
          callUuid: null,
          name: participant.name,
          joinTime: participant.joinTime,
          leaveTime: participant.leaveTime,
        },
      })

  if (!existingParticipant) {
    return prisma.participant.create({
      data: {
        conferenceId,
        name: participant.name,
        callUuid: participant.callUuid,
        joinTime: participant.joinTime,
        leaveTime: participant.leaveTime,
        duration,
        protocol: participant.protocol ?? null,
        vendor: participant.vendor ?? null,
        callDirection: participant.callDirection ?? null,
        encryption: participant.encryption ?? null,
        sourceAlias: participant.sourceAlias ?? null,
        destinationAlias: participant.destinationAlias ?? null,
        remoteAddress: participant.remoteAddress ?? null,
        mediaNode: participant.mediaNode ?? null,
        signallingNode: participant.signallingNode ?? null,
        disconnectReason: participant.disconnectReason ?? null,
        role: participant.role ?? null,
        rxBandwidth: participant.rxBandwidth ?? null,
        txBandwidth: participant.txBandwidth ?? null,
        identity: participant.identity ?? null,
      },
    })
  }

  const updateData: {
    conferenceId?: number
    name?: string | null
    joinTime?: Date
    leaveTime?: Date | null
    duration?: number | null
    protocol?: string | null
    vendor?: string | null
    callDirection?: string | null
    encryption?: string | null
    sourceAlias?: string | null
    destinationAlias?: string | null
    remoteAddress?: string | null
    mediaNode?: string | null
    signallingNode?: string | null
    disconnectReason?: string | null
    role?: string | null
    rxBandwidth?: number | null
    txBandwidth?: number | null
    identity?: string | null
  } = {}

  if (existingParticipant.conferenceId !== conferenceId) {
    await log('warn', 'Reassigning imported participant to a different conference', {
      source: LOG_SOURCE,
      details: `Participant ${existingParticipant.id} (${participant.callUuid ?? participant.name ?? 'unknown'}) moved from conference ${existingParticipant.conferenceId} to ${conferenceId}`,
    })
    updateData.conferenceId = conferenceId
  }
  if (participant.name !== null && participant.name !== existingParticipant.name) updateData.name = participant.name
  if (existingParticipant.joinTime.getTime() !== participant.joinTime.getTime()) updateData.joinTime = participant.joinTime
  if (
    (existingParticipant.leaveTime?.getTime() ?? null) !== (participant.leaveTime?.getTime() ?? null)
    && participant.leaveTime !== null
  ) {
    updateData.leaveTime = participant.leaveTime
  }
  if (duration !== null && duration !== existingParticipant.duration) updateData.duration = duration

  // Backfill descriptive fields from history when they are missing on the existing
  // record. We only overwrite when the existing value is null/empty so that more
  // detailed data already captured by the realtime events webhook is preserved.
  const backfillString = (
    incoming: string | null | undefined,
    existing: string | null,
    key: keyof typeof updateData,
  ) => {
    if (incoming && (existing === null || existing === '')) {
      ;(updateData as Record<string, unknown>)[key as string] = incoming
    }
  }
  const backfillNumber = (
    incoming: number | null | undefined,
    existing: number | null,
    key: keyof typeof updateData,
  ) => {
    if (typeof incoming === 'number' && existing === null) {
      ;(updateData as Record<string, unknown>)[key as string] = incoming
    }
  }

  backfillString(participant.protocol, existingParticipant.protocol, 'protocol')
  backfillString(participant.vendor, existingParticipant.vendor, 'vendor')
  backfillString(participant.callDirection, existingParticipant.callDirection, 'callDirection')
  backfillString(participant.encryption, existingParticipant.encryption, 'encryption')
  backfillString(participant.sourceAlias, existingParticipant.sourceAlias, 'sourceAlias')
  backfillString(participant.destinationAlias, existingParticipant.destinationAlias, 'destinationAlias')
  backfillString(participant.remoteAddress, existingParticipant.remoteAddress, 'remoteAddress')
  backfillString(participant.mediaNode, existingParticipant.mediaNode, 'mediaNode')
  backfillString(participant.signallingNode, existingParticipant.signallingNode, 'signallingNode')
  backfillString(participant.disconnectReason, existingParticipant.disconnectReason, 'disconnectReason')
  backfillString(participant.role, existingParticipant.role, 'role')
  backfillString(participant.identity, existingParticipant.identity, 'identity')
  backfillNumber(participant.rxBandwidth, existingParticipant.rxBandwidth, 'rxBandwidth')
  backfillNumber(participant.txBandwidth, existingParticipant.txBandwidth, 'txBandwidth')

  if (Object.keys(updateData).length === 0) {
    return existingParticipant
  }

  return prisma.participant.update({
    where: { id: existingParticipant.id },
    data: updateData,
  })
}
