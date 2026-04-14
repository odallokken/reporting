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
