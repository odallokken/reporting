import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const events = await prisma.participant.findMany({
      take: 100,
      orderBy: { joinTime: 'desc' },
      include: {
        conference: {
          include: { vmr: true }
        }
      }
    })

    return NextResponse.json({
      events: events.map(e => ({
        id: e.id,
        name: e.name,
        joinTime: e.joinTime.toISOString(),
        leaveTime: e.leaveTime?.toISOString() ?? null,
        callUuid: e.callUuid,
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
