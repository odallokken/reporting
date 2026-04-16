export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, subDays } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

export async function GET() {
  try {
    const thirtyDaysAgo = subDays(new Date(), 30)
    const excludedIds = await getShortConferenceIds()
    const excludeFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    const [activeVmrs, activeConferences, activeParticipants, recentActivity, recentConferences] = await Promise.all([
      prisma.vMR.count({ where: { lastUsedAt: { gte: thirtyDaysAgo } } }),
      prisma.conference.count({
        where: {
          endTime: null,
          participants: { some: { leaveTime: null } },
          ...excludeFilter
        }
      }),
      prisma.participant.count({ where: { leaveTime: null, conference: { endTime: null, ...excludeFilter } } }),
      prisma.participant.findMany({
        take: 10,
        orderBy: { joinTime: 'desc' },
        where: { conference: excludeFilter },
        include: { conference: { include: { vmr: true } } }
      }),
      prisma.conference.findMany({
        where: { startTime: { gte: thirtyDaysAgo }, ...excludeFilter },
        select: { startTime: true }
      })
    ])

    const dayMap: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = subDays(new Date(), 29 - i)
      dayMap[format(d, 'yyyy-MM-dd')] = 0
    }
    for (const conf of recentConferences) {
      const key = format(new Date(conf.startTime), 'yyyy-MM-dd')
      if (key in dayMap) dayMap[key]++
    }
    const usageByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

    return NextResponse.json({
      activeVmrs,
      activeConferences,
      activeParticipants,
      recentActivity,
      usageByDay,
      topVmrs: []
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
