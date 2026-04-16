export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays, format } from 'date-fns'

export async function GET() {
  try {
    const thirtyDaysAgo = subDays(new Date(), 30)

    // 1. Quality distribution: count participants by callQuality
    const allParticipants = await prisma.participant.findMany({
      where: {
        leaveTime: { not: null },
        callQuality: { not: null },
        joinTime: { gte: thirtyDaysAgo },
      },
      select: { callQuality: true },
    })

    const qualityDistribution: Record<string, number> = {
      good: 0,
      ok: 0,
      bad: 0,
      terrible: 0,
      unknown: 0,
    }
    for (const p of allParticipants) {
      const q = p.callQuality ?? ''
      if (q.includes('good')) qualityDistribution.good++
      else if (q.includes('ok')) qualityDistribution.ok++
      else if (q.includes('bad')) qualityDistribution.bad++
      else if (q.includes('terrible')) qualityDistribution.terrible++
      else qualityDistribution.unknown++
    }

    // 2. Quality trends: average quality per day over last 30 days
    const qualityWindows = await prisma.qualityWindow.findMany({
      where: {
        timestamp: { gte: thirtyDaysAgo },
        overallQuality: { not: null },
      },
      select: { timestamp: true, overallQuality: true },
    })

    const dayQuality: Record<string, { total: number; count: number }> = {}
    for (let i = 0; i < 30; i++) {
      const d = subDays(new Date(), 29 - i)
      dayQuality[format(d, 'yyyy-MM-dd')] = { total: 0, count: 0 }
    }
    for (const w of qualityWindows) {
      const key = format(new Date(w.timestamp), 'yyyy-MM-dd')
      if (key in dayQuality && w.overallQuality !== null) {
        dayQuality[key].total += w.overallQuality
        dayQuality[key].count++
      }
    }
    const qualityTrends = Object.entries(dayQuality).map(([date, { total, count }]) => ({
      date,
      avgQuality: count > 0 ? Math.round((total / count) * 100) / 100 : null,
      sampleCount: count,
    }))

    // 3. Problem calls: recent participants with bad/terrible quality or high packet loss
    const problemCalls = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        leaveTime: { not: null },
        OR: [
          { callQuality: { contains: 'bad' } },
          { callQuality: { contains: 'terrible' } },
        ],
      },
      take: 50,
      orderBy: { joinTime: 'desc' },
      include: {
        conference: { include: { vmr: { select: { name: true } } } },
        mediaStreams: {
          select: {
            streamType: true,
            rxPacketLoss: true,
            txPacketLoss: true,
            rxCodec: true,
            txCodec: true,
          },
        },
      },
    })

    const formattedProblemCalls = problemCalls.map((p) => ({
      id: p.id,
      name: p.name,
      protocol: p.protocol,
      callQuality: p.callQuality,
      joinTime: p.joinTime.toISOString(),
      leaveTime: p.leaveTime?.toISOString() ?? null,
      duration: p.duration,
      vmrName: p.conference.vmr.name,
      vendor: p.vendor,
      mediaStreams: p.mediaStreams.map((ms) => ({
        streamType: ms.streamType,
        rxPacketLoss: ms.rxPacketLoss,
        txPacketLoss: ms.txPacketLoss,
      })),
    }))

    // 4. Packet loss summary for streams in last 30 days
    const streams = await prisma.mediaStream.findMany({
      where: {
        participant: { joinTime: { gte: thirtyDaysAgo } },
        OR: [
          { rxPacketLoss: { not: null } },
          { txPacketLoss: { not: null } },
        ],
      },
      select: {
        streamType: true,
        rxPacketLoss: true,
        txPacketLoss: true,
      },
    })

    const packetLossBuckets = {
      good: 0,    // < 0.2%
      warning: 0, // 0.2% - 2%
      bad: 0,     // >= 2%
    }
    for (const s of streams) {
      const maxLoss = Math.max(s.rxPacketLoss ?? 0, s.txPacketLoss ?? 0)
      if (maxLoss < 0.2) packetLossBuckets.good++
      else if (maxLoss < 2) packetLossBuckets.warning++
      else packetLossBuckets.bad++
    }

    return NextResponse.json({
      qualityDistribution,
      qualityTrends,
      problemCalls: formattedProblemCalls,
      packetLossBuckets,
      totalParticipants: allParticipants.length,
    })
  } catch (error) {
    console.error('Quality API error:', error)
    return NextResponse.json({ error: 'Failed to fetch quality data' }, { status: 500 })
  }
}
