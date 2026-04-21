import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const participantId = parseInt(id, 10)
    if (isNaN(participantId)) {
      return NextResponse.json({ error: 'Invalid participant ID' }, { status: 400 })
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        conference: {
          include: { vmr: true }
        },
        mediaStreams: {
          orderBy: { createdAt: 'desc' }
        },
        qualityWindows: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        }
      }
    })

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: participant.id,
      name: participant.name,
      identity: participant.identity,
      joinTime: participant.joinTime.toISOString(),
      leaveTime: participant.leaveTime?.toISOString() ?? null,
      callUuid: participant.callUuid,
      protocol: participant.protocol,
      role: participant.role,
      sourceAlias: participant.sourceAlias,
      destinationAlias: participant.destinationAlias,
      callDirection: participant.callDirection,
      remoteAddress: participant.remoteAddress,
      vendor: participant.vendor,
      rxBandwidth: participant.rxBandwidth,
      txBandwidth: participant.txBandwidth,
      mediaNode: participant.mediaNode,
      signallingNode: participant.signallingNode,
      encryption: participant.encryption,
      isMuted: participant.isMuted,
      isPresenting: participant.isPresenting,
      disconnectReason: participant.disconnectReason,
      duration: participant.duration,
      callQuality: participant.callQuality,
      audioQuality: participant.audioQuality,
      videoQuality: participant.videoQuality,
      mediaStreams: participant.mediaStreams.map(ms => ({
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
      })),
      qualityWindows: participant.qualityWindows.map(qw => ({
        id: qw.id,
        qualityWas: qw.qualityWas,
        qualityNow: qw.qualityNow,
        audioQuality: qw.audioQuality,
        videoQuality: qw.videoQuality,
        presentationQuality: qw.presentationQuality,
        overallQuality: qw.overallQuality,
        rxPacketsLost: qw.rxPacketsLost,
        rxPacketsRecv: qw.rxPacketsRecv,
        txPacketsLost: qw.txPacketsLost,
        txPacketsSent: qw.txPacketsSent,
        timestamp: qw.timestamp.toISOString(),
      })),
      conference: {
        id: participant.conference.id,
        startTime: participant.conference.startTime.toISOString(),
        endTime: participant.conference.endTime?.toISOString() ?? null,
        callId: participant.conference.callId,
        vmr: {
          id: participant.conference.vmr.id,
          name: participant.conference.vmr.name,
        }
      }
    })
  } catch (error) {
    console.error('Participant detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
