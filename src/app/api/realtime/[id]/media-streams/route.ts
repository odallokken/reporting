import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchWithBasicAuth } from '@/lib/pexip'

const PEXIP_FETCH_TIMEOUT_MS = 4000
const THROTTLE_WINDOW_MS = 2000

interface PexipParticipantStatus {
  resource_uri: string
  call_uuid?: string
  conference?: string
}

interface PexipMediaStreamStatus {
  stream_id?: string | number | null
  stream_type: string
  node?: string | null
  start_time?: number | string | null
  end_time?: number | string | null
  rx_bitrate?: number | null
  rx_codec?: string | null
  rx_fps?: number | null
  rx_packet_loss?: number | null
  rx_current_packet_loss?: number | null
  rx_jitter?: number | null
  rx_packets_lost?: number | null
  rx_packets_received?: number | null
  rx_resolution?: string | null
  tx_bitrate?: number | null
  tx_codec?: string | null
  tx_fps?: number | null
  tx_packet_loss?: number | null
  tx_current_packet_loss?: number | null
  tx_jitter?: number | null
  tx_packets_lost?: number | null
  tx_packets_sent?: number | null
  tx_resolution?: string | null
}

interface MediaStreamApiResponse {
  source: 'live' | 'cached'
  fetchedAt: string
  warning?: string
  mediaStreams: SerializedMediaStream[]
}

interface SerializedMediaStream {
  id: number
  streamId: string | null
  streamType: string
  rxBitrate: number | null
  rxCodec: string | null
  rxFps: number | null
  rxPacketLoss: number | null
  rxCurrentPacketLoss: number | null
  rxJitter: number | null
  rxPacketsLost: number | null
  rxPacketsRecv: number | null
  rxResolution: string | null
  txBitrate: number | null
  txCodec: string | null
  txFps: number | null
  txPacketLoss: number | null
  txCurrentPacketLoss: number | null
  txJitter: number | null
  txPacketsLost: number | null
  txPacketsSent: number | null
  txResolution: string | null
  startTime: string | null
  endTime: string | null
  node: string | null
  updatedAt: string
}

// In-memory throttle to avoid hammering the Pexip Management Node when many
// clients (or tabs) poll the same participant.
const lastFetchByCallUuid = new Map<string, number>()

function fetchWithTimeout(url: string, username: string, password: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Pexip request timed out')), PEXIP_FETCH_TIMEOUT_MS)
    fetchWithBasicAuth(url, username, password)
      .then((res) => {
        clearTimeout(timer)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

function parsePexipTime(value: number | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const numeric = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(numeric)) {
    // Pexip uses Unix seconds.
    return new Date(numeric * 1000)
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}

type MediaStreamRow = {
  id: number
  streamId: string | null
  streamType: string
  rxBitrate: number | null
  rxCodec: string | null
  rxFps: number | null
  rxPacketLoss: number | null
  rxCurrentPacketLoss: number | null
  rxJitter: number | null
  rxPacketsLost: number | null
  rxPacketsRecv: number | null
  rxResolution: string | null
  txBitrate: number | null
  txCodec: string | null
  txFps: number | null
  txPacketLoss: number | null
  txCurrentPacketLoss: number | null
  txJitter: number | null
  txPacketsLost: number | null
  txPacketsSent: number | null
  txResolution: string | null
  startTime: Date | null
  endTime: Date | null
  node: string | null
  updatedAt: Date
}

function serializeMediaStream(ms: MediaStreamRow): SerializedMediaStream {
  return {
    id: ms.id,
    streamId: ms.streamId,
    streamType: ms.streamType,
    rxBitrate: ms.rxBitrate,
    rxCodec: ms.rxCodec,
    rxFps: ms.rxFps,
    rxPacketLoss: ms.rxPacketLoss,
    rxCurrentPacketLoss: ms.rxCurrentPacketLoss,
    rxJitter: ms.rxJitter,
    rxPacketsLost: ms.rxPacketsLost,
    rxPacketsRecv: ms.rxPacketsRecv,
    rxResolution: ms.rxResolution,
    txBitrate: ms.txBitrate,
    txCodec: ms.txCodec,
    txFps: ms.txFps,
    txPacketLoss: ms.txPacketLoss,
    txCurrentPacketLoss: ms.txCurrentPacketLoss,
    txJitter: ms.txJitter,
    txPacketsLost: ms.txPacketsLost,
    txPacketsSent: ms.txPacketsSent,
    txResolution: ms.txResolution,
    startTime: ms.startTime?.toISOString() ?? null,
    endTime: ms.endTime?.toISOString() ?? null,
    node: ms.node,
    updatedAt: ms.updatedAt.toISOString(),
  }
}

async function loadCachedMediaStreams(participantId: number): Promise<SerializedMediaStream[]> {
  const rows = await prisma.mediaStream.findMany({
    where: { participantId },
    orderBy: [{ streamType: 'asc' }, { id: 'asc' }],
  })
  return rows.map(serializeMediaStream)
}

function buildResponse(
  source: 'live' | 'cached',
  mediaStreams: SerializedMediaStream[],
  warning?: string,
): MediaStreamApiResponse {
  return {
    source,
    fetchedAt: new Date().toISOString(),
    mediaStreams,
    ...(warning ? { warning } : {}),
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const participantId = parseInt(id, 10)
    if (isNaN(participantId)) {
      return NextResponse.json({ error: 'Invalid participant ID' }, { status: 400 })
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: { conference: { select: { endTime: true } } },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const isLive = !participant.leaveTime && !participant.conference.endTime

    // For ended sessions, just return whatever is cached.
    if (!isLive) {
      const cached = await loadCachedMediaStreams(participantId)
      return NextResponse.json(buildResponse('cached', cached))
    }

    // Read credentials from the request body (the client posts these from the
    // browser credential store, mirroring the existing Pexip-backed endpoints).
    let baseUrl = ''
    let username = ''
    let password = ''
    try {
      const body = (await request.json().catch(() => ({}))) as {
        baseUrl?: string
        username?: string
        password?: string
      }
      baseUrl = body.baseUrl?.trim() ?? ''
      username = body.username?.trim() ?? ''
      password = body.password ?? ''
    } catch {
      // ignore; treat as missing credentials
    }

    if (!baseUrl || !username || !password || !participant.callUuid) {
      const cached = await loadCachedMediaStreams(participantId)
      const warning = !participant.callUuid
        ? 'Participant has no call UUID; live data unavailable.'
        : 'Configure Pexip credentials in Settings to enable live media stream stats.'
      return NextResponse.json(buildResponse('cached', cached, warning))
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(baseUrl)
      if (parsedUrl.protocol !== 'https:') {
        const cached = await loadCachedMediaStreams(participantId)
        return NextResponse.json(
          buildResponse('cached', cached, 'Pexip base URL must use HTTPS.'),
        )
      }
    } catch {
      const cached = await loadCachedMediaStreams(participantId)
      return NextResponse.json(
        buildResponse('cached', cached, 'Invalid Pexip base URL configured.'),
      )
    }

    // Throttle per call UUID to avoid hammering the Management Node when
    // multiple clients poll the same participant.
    const now = Date.now()
    const lastFetch = lastFetchByCallUuid.get(participant.callUuid) ?? 0
    if (now - lastFetch < THROTTLE_WINDOW_MS) {
      const cached = await loadCachedMediaStreams(participantId)
      return NextResponse.json(buildResponse('live', cached))
    }
    lastFetchByCallUuid.set(participant.callUuid, now)

    try {
      // 1. Look up the live participant by call UUID to get its resource_uri.
      const participantStatusUrl = new URL(
        '/api/admin/status/v1/participant/',
        parsedUrl.origin,
      )
      participantStatusUrl.searchParams.set('call_uuid', participant.callUuid)

      const participantRes = await fetchWithTimeout(
        participantStatusUrl.toString(),
        username,
        password,
      )
      if (!participantRes.ok) {
        const cached = await loadCachedMediaStreams(participantId)
        return NextResponse.json(
          buildResponse(
            'cached',
            cached,
            `Pexip participant lookup failed: ${participantRes.status}`,
          ),
        )
      }

      const participantData = (await participantRes.json()) as {
        objects?: PexipParticipantStatus[]
      }
      const liveParticipant = participantData.objects?.[0]
      if (!liveParticipant) {
        const cached = await loadCachedMediaStreams(participantId)
        return NextResponse.json(
          buildResponse('cached', cached, 'Participant is no longer active on the Pexip node.'),
        )
      }

      // 2. Pull the per-stream media data for that participant.
      const mediaStreamUrl = new URL(
        '/api/admin/status/v1/participant_media_stream/',
        parsedUrl.origin,
      )
      mediaStreamUrl.searchParams.set('participant', liveParticipant.resource_uri)
      mediaStreamUrl.searchParams.set('limit', '50')

      const mediaRes = await fetchWithTimeout(
        mediaStreamUrl.toString(),
        username,
        password,
      )
      if (!mediaRes.ok) {
        const cached = await loadCachedMediaStreams(participantId)
        return NextResponse.json(
          buildResponse(
            'cached',
            cached,
            `Pexip media stream lookup failed: ${mediaRes.status}`,
          ),
        )
      }

      const mediaData = (await mediaRes.json()) as { objects?: PexipMediaStreamStatus[] }
      const liveStreams = mediaData.objects ?? []

      // 3. Upsert each live stream into the DB on the unique key.
      for (const stream of liveStreams) {
        const streamId = stream.stream_id != null ? String(stream.stream_id) : null
        const data = {
          participantId,
          streamId,
          streamType: stream.stream_type,
          rxBitrate: stream.rx_bitrate ?? null,
          rxCodec: stream.rx_codec ?? null,
          rxFps: stream.rx_fps ?? null,
          rxPacketLoss: stream.rx_packet_loss ?? null,
          rxCurrentPacketLoss: stream.rx_current_packet_loss ?? null,
          rxJitter: stream.rx_jitter ?? null,
          rxPacketsLost: stream.rx_packets_lost ?? null,
          rxPacketsRecv: stream.rx_packets_received ?? null,
          rxResolution: stream.rx_resolution ?? null,
          txBitrate: stream.tx_bitrate ?? null,
          txCodec: stream.tx_codec ?? null,
          txFps: stream.tx_fps ?? null,
          txPacketLoss: stream.tx_packet_loss ?? null,
          txCurrentPacketLoss: stream.tx_current_packet_loss ?? null,
          txJitter: stream.tx_jitter ?? null,
          txPacketsLost: stream.tx_packets_lost ?? null,
          txPacketsSent: stream.tx_packets_sent ?? null,
          txResolution: stream.tx_resolution ?? null,
          startTime: parsePexipTime(stream.start_time),
          endTime: parsePexipTime(stream.end_time),
          node: stream.node ?? null,
        }

        if (streamId) {
          await prisma.mediaStream.upsert({
            where: {
              participant_stream_unique: {
                participantId,
                streamId,
                streamType: stream.stream_type,
              },
            },
            create: data,
            update: data,
          })
        } else {
          // Without a stream_id we can't safely upsert (multiple rows could
          // exist). Fall back to creating a fresh row.
          await prisma.mediaStream.create({ data })
        }
      }

      const merged = await loadCachedMediaStreams(participantId)
      return NextResponse.json(buildResponse('live', merged))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const cached = await loadCachedMediaStreams(participantId)
      return NextResponse.json(
        buildResponse('cached', cached, `Could not reach Pexip Management Node: ${message}`),
      )
    }
  } catch (error) {
    console.error('Live media stream error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
