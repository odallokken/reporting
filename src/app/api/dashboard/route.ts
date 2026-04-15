import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, subDays } from 'date-fns'

export async function GET() {
  try {
    const thirtyDaysAgo = subDays(new Date(), 30)

    const [totalVmrs, activeVmrs, totalConferences, totalParticipants, activeConferences, activeParticipants, recentActivity, recentConferences] = await Promise.all([
      prisma.vMR.count(),
      prisma.vMR.count({ where: { lastUsedAt: { gte: thirtyDaysAgo } } }),
      prisma.conference.count(),
      prisma.participant.count(),
      prisma.conference.count({ where: { endTime: null } }),
      prisma.participant.count({ where: { leaveTime: null, conference: { endTime: null } } }),
      prisma.participant.findMany({
        take: 10,
        orderBy: { joinTime: 'desc' },
        include: { conference: { include: { vmr: true } } }
      }),
      prisma.conference.findMany({
        where: { startTime: { gte: thirtyDaysAgo } },
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

    const vmrConferenceCounts = await prisma.conference.groupBy({
      by: ['vmrId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    })
    const vmrIds = vmrConferenceCounts.map(v => v.vmrId)
    const vmrs = await prisma.vMR.findMany({ where: { id: { in: vmrIds } } })
    const vmrMap = Object.fromEntries(vmrs.map(v => [v.id, v.name]))
    const topVmrs = vmrConferenceCounts.map(v => ({
      name: vmrMap[v.vmrId] ?? `VMR ${v.vmrId}`,
      count: v._count.id
    }))

    return NextResponse.json({
      totalVmrs,
      activeVmrs,
      staleVmrs: totalVmrs - activeVmrs,
      totalConferences,
      totalParticipants,
      activeConferences,
      activeParticipants,
      recentActivity,
      usageByDay,
      topVmrs
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
