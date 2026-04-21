import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PexipEvent, PexipEventData } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PexipEvent

    if (body.event === 'eventsink_bulk' && Array.isArray(body.data)) {
      for (const evt of body.data) {
        processSingleEvent(evt).catch(err => console.error('Failed to process Pexip bulk event:', err))
      }
    } else {
      processSingleEvent(body).catch(err => console.error('Failed to process Pexip event:', err))
    }

    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

async function processSingleEvent(body: PexipEvent) {
  const { event, time } = body
  const data = body.data as PexipEventData
  const timestamp = new Date(time * 1000)

  // For conference events, the conference name is in data.name
  // For participant events, the conference name is in data.conference
  const conferenceName = data.conference ?? data.name

  // Quality-only events (media_stream_window, media_streams_destroyed) may not have conference name
  if (!conferenceName && event !== 'participant_media_stream_window' && event !== 'participant_media_streams_destroyed') return

  let vmr = null
  if (conferenceName) {
    vmr = await prisma.vMR.upsert({
      where: { name: conferenceName },
      update: { lastUsedAt: timestamp },
      create: { name: conferenceName, lastUsedAt: timestamp }
    })
  }

  const callId = data.call_id ?? null

  if (event === 'conference_started') {
    if (!vmr) return
    try {
      await prisma.conference.create({
        data: { vmrId: vmr.id, startTime: timestamp, callId }
      })
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
        console.error('Unexpected error creating conference:', err)
      }
    }
  } else if (event === 'conference_ended') {
    if (callId) {
      await prisma.conference.updateMany({
        where: { callId },
        data: { endTime: timestamp }
      })
    }
  } else if (event === 'participant_connected') {
    if (!vmr) return
    let conf = callId ? await prisma.conference.findUnique({ where: { callId } }) : null
    if (!conf) {
      try {
        conf = await prisma.conference.create({
          data: { vmrId: vmr.id, startTime: timestamp, callId }
        })
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
          console.error('Unexpected error creating conference for participant:', err)
        }
        if (callId) {
          conf = await prisma.conference.findUnique({ where: { callId } })
        }
      }
    }
    const callUuid = data.uuid ?? null
    if (conf && callUuid) {
      await prisma.participant.upsert({
        where: { callUuid },
        update: { joinTime: timestamp },
        create: {
          conferenceId: conf.id,
          name: data.display_name ?? null,
          identity: data.source_alias ?? null,
          callUuid,
          joinTime: timestamp,
          protocol: data.protocol ?? null,
          role: data.role ?? null,
          sourceAlias: data.source_alias ?? null,
          destinationAlias: data.destination_alias ?? null,
          callDirection: data.call_direction ?? null,
          remoteAddress: data.remote_address ?? null,
          vendor: data.vendor ?? null,
          rxBandwidth: data.rx_bandwidth ?? null,
          txBandwidth: data.tx_bandwidth ?? null,
          mediaNode: data.media_node ?? null,
          signallingNode: data.signalling_node ?? null,
          encryption: data.encryption ?? null,
          isMuted: data.is_muted ?? null,
          isPresenting: data.is_presenting ?? null,
        }
      })
    }
  } else if (event === 'participant_updated') {
    const callUuid = data.uuid ?? null
    if (callUuid) {
      const updateData: Record<string, unknown> = {}
      if (data.rx_bandwidth !== undefined) updateData.rxBandwidth = data.rx_bandwidth
      if (data.tx_bandwidth !== undefined) updateData.txBandwidth = data.tx_bandwidth
      if (data.is_muted !== undefined) updateData.isMuted = data.is_muted
      if (data.is_presenting !== undefined) updateData.isPresenting = data.is_presenting
      if (data.role !== undefined) updateData.role = data.role
      if (data.encryption !== undefined) updateData.encryption = data.encryption
      if (data.media_node !== undefined) updateData.mediaNode = data.media_node
      if (Object.keys(updateData).length > 0) {
        await prisma.participant.updateMany({
          where: { callUuid },
          data: updateData
        })
      }
    }
  } else if (event === 'participant_disconnected') {
    const callUuid = data.uuid ?? null
    if (callUuid) {
      await prisma.participant.updateMany({
        where: { callUuid },
        data: {
          leaveTime: timestamp,
          disconnectReason: data.disconnect_reason ?? null,
          duration: data.duration ?? null,
        }
      })
      // Store end-of-call media streams if provided (v2 API)
      if (data.media_streams && data.media_streams.length > 0) {
        await storeMediaStreams(callUuid, data.media_streams)
      }
    }
  } else if (event === 'participant_media_stream_window') {
    const callUuid = data.uuid ?? null
    if (callUuid) {
      // Update the participant's current quality
      const qualityUpdate: Record<string, unknown> = {}
      if (data.call_quality_now) qualityUpdate.callQuality = data.call_quality_now

      // Extract the most recent quality entry for audio/video
      if (data.recent_quality && data.recent_quality.length > 0) {
        const latest = data.recent_quality[data.recent_quality.length - 1]
        if (latest.audio !== null && latest.audio !== undefined) {
          qualityUpdate.audioQuality = qualityValue(latest.audio)
        }
        if (latest.video !== null && latest.video !== undefined) {
          qualityUpdate.videoQuality = qualityValue(latest.video)
        }
      }

      if (Object.keys(qualityUpdate).length > 0) {
        await prisma.participant.updateMany({
          where: { callUuid },
          data: qualityUpdate
        })
      }

      // Find participant to store quality window
      const participant = await prisma.participant.findUnique({ where: { callUuid } })
      if (participant) {
        // Aggregate packet loss from history
        let totalRxLost = 0, totalRxRecv = 0, totalTxLost = 0, totalTxSent = 0
        if (data.packet_loss_history) {
          for (const entry of data.packet_loss_history) {
            totalRxLost += entry.rx_packets_lost ?? 0
            totalRxRecv += entry.rx_packets_received ?? 0
            totalTxLost += entry.tx_packets_lost ?? 0
            totalTxSent += entry.tx_packets_sent ?? 0
          }
        }

        const latestQuality = data.recent_quality?.length
          ? data.recent_quality[data.recent_quality.length - 1]
          : null

        await prisma.qualityWindow.create({
          data: {
            participantId: participant.id,
            qualityWas: data.call_quality_was ?? null,
            qualityNow: data.call_quality_now ?? null,
            audioQuality: latestQuality?.audio ?? null,
            videoQuality: latestQuality?.video ?? null,
            presentationQuality: latestQuality?.presentation ?? null,
            overallQuality: latestQuality?.quality ?? null,
            rxPacketsLost: totalRxLost,
            rxPacketsRecv: totalRxRecv,
            txPacketsLost: totalTxLost,
            txPacketsSent: totalTxSent,
            timestamp,
          }
        })
      }
    }
  } else if (event === 'participant_media_streams_destroyed') {
    const callUuid = data.uuid ?? null
    if (callUuid && data.media_streams && data.media_streams.length > 0) {
      await storeMediaStreams(callUuid, data.media_streams)
    }
  }
}

async function storeMediaStreams(callUuid: string, streams: NonNullable<PexipEventData['media_streams']>) {
  const participant = await prisma.participant.findUnique({ where: { callUuid } })
  if (!participant) return

  for (const stream of streams) {
    const data = {
      participantId: participant.id,
      streamId: stream.stream_id ?? null,
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
      startTime: stream.start_time ? new Date(stream.start_time * 1000) : null,
      endTime: stream.end_time ? new Date(stream.end_time * 1000) : null,
      node: stream.node ?? null,
    }

    if (stream.stream_id) {
      await prisma.mediaStream.upsert({
        where: {
          participant_stream_unique: {
            participantId: participant.id,
            streamId: stream.stream_id,
            streamType: stream.stream_type,
          },
        },
        create: data,
        update: data,
      })
    } else {
      await prisma.mediaStream.create({ data })
    }
  }
}

function qualityValue(value: number): string {
  switch (value) {
    case 0: return '0_unknown'
    case 1: return '1_good'
    case 2: return '2_ok'
    case 3: return '3_bad'
    case 4: return '4_terrible'
    default: return '0_unknown'
  }
}
