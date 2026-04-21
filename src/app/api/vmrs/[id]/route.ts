import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const id = parseInt(rawId)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const excludedIds = await getShortConferenceIds()

    const vmr = await prisma.vMR.findUnique({
      where: { id },
      include: {
        conferences: {
          where: {
            ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
            participants: { some: {} },
          },
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

    if (!vmr) return NextResponse.json({ error: 'VMR not found' }, { status: 404 })

    const totalConferences = vmr.conferences.length
    const totalParticipants = vmr.conferences.reduce((sum, c) => sum + c._count.participants, 0)
    const avgParticipants = totalConferences > 0 ? Math.round(totalParticipants / totalConferences) : 0
    const staleThreshold = subDays(new Date(), 30)
    const isStale = !vmr.lastUsedAt || vmr.lastUsedAt < staleThreshold

    return NextResponse.json({
      id: vmr.id,
      name: vmr.name,
      lastUsedAt: vmr.lastUsedAt?.toISOString() ?? null,
      createdAt: vmr.createdAt.toISOString(),
      isStale,
      stats: { totalConferences, totalParticipants, avgParticipants },
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
    console.error('VMR detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
