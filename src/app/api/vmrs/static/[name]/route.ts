import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShortConferenceIds } from '@/lib/settings'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: rawName } = await params
    const name = decodeURIComponent(rawName)

    const excludedIds = await getShortConferenceIds()

    const vmr = await prisma.vMR.findUnique({
      where: { name },
      include: {
        conferences: {
          where: excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {},
          orderBy: { startTime: 'desc' },
          include: {
            _count: { select: { participants: true } },
            participants: {
              orderBy: { joinTime: 'asc' }
            }
          }
        }
      }
    })

    if (!vmr) {
      return NextResponse.json({
        name,
        lastUsedAt: null,
        totalConferences: 0,
        totalParticipants: 0,
        avgParticipants: 0,
        conferences: []
      })
    }

    const totalConferences = vmr.conferences.length
    const totalParticipants = vmr.conferences.reduce((sum, c) => sum + c._count.participants, 0)
    const avgParticipants = totalConferences > 0 ? Math.round(totalParticipants / totalConferences) : 0

    return NextResponse.json({
      name: vmr.name,
      lastUsedAt: vmr.conferences[0]?.startTime?.toISOString() ?? null,
      totalConferences,
      totalParticipants,
      avgParticipants,
      conferences: vmr.conferences.map(c => ({
        id: c.id,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime?.toISOString() ?? null,
        callId: c.callId,
        participantCount: c._count.participants,
        participants: c.participants.map(p => ({
          id: p.id,
          name: p.name,
          identity: p.identity,
          joinTime: p.joinTime.toISOString(),
          leaveTime: p.leaveTime?.toISOString() ?? null,
          callUuid: p.callUuid
        }))
      }))
    })
  } catch (error) {
    console.error('Static VMR detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
