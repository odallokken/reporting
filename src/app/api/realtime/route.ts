import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const events = await prisma.participant.findMany({
      where: {
        leaveTime: null,
        conference: { endTime: null }
      },
      take: 100,
      orderBy: { joinTime: 'desc' },
      include: {
        conference: {
          include: { vmr: true }
        },
        qualityWindows: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        }
      }
    })

    return NextResponse.json({
      events: events.map(e => ({
        id: e.id,
        name: e.name,
        identity: e.identity,
        joinTime: e.joinTime.toISOString(),
        leaveTime: e.leaveTime?.toISOString() ?? null,
        callUuid: e.callUuid,
        protocol: e.protocol,
        role: e.role,
        callQuality: e.callQuality,
        audioQuality: e.audioQuality,
        videoQuality: e.videoQuality,
        rxBandwidth: e.rxBandwidth,
        txBandwidth: e.txBandwidth,
        encryption: e.encryption,
        mediaNode: e.mediaNode,
        latestQuality: e.qualityWindows[0] ? {
          overallQuality: e.qualityWindows[0].overallQuality,
          audioQuality: e.qualityWindows[0].audioQuality,
          videoQuality: e.qualityWindows[0].videoQuality,
          presentationQuality: e.qualityWindows[0].presentationQuality,
          rxPacketsLost: e.qualityWindows[0].rxPacketsLost,
          rxPacketsRecv: e.qualityWindows[0].rxPacketsRecv,
          txPacketsLost: e.qualityWindows[0].txPacketsLost,
          txPacketsSent: e.qualityWindows[0].txPacketsSent,
          timestamp: e.qualityWindows[0].timestamp.toISOString(),
        } : null,
        conference: {
          id: e.conference.id,
          vmr: { id: e.conference.vmr.id, name: e.conference.vmr.name }
        }
      }))
    })
  } catch (error) {
    console.error('Realtime error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
