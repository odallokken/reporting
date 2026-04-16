export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays, format } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

export async function GET() {
  try {
    const thirtyDaysAgo = subDays(new Date(), 30)
    const excludedIds = await getShortConferenceIds()
    const excludeFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    // 1. Protocol breakdown
    const participantsWithProtocol = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        protocol: { not: null },
        conference: excludeFilter,
      },
      select: { protocol: true },
    })

    const protocolCounts: Record<string, number> = {}
    for (const p of participantsWithProtocol) {
      const proto = p.protocol ?? 'Unknown'
      protocolCounts[proto] = (protocolCounts[proto] ?? 0) + 1
    }
    const protocolBreakdown = Object.entries(protocolCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // 2. Vendor breakdown
    const participantsWithVendor = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        vendor: { not: null },
        conference: excludeFilter,
      },
      select: { vendor: true },
    })

    const vendorCounts: Record<string, number> = {}
    for (const p of participantsWithVendor) {
      // Normalize vendor strings to brand names
      const raw = (p.vendor ?? 'Unknown').toLowerCase()
      let vendor = 'Other'
      if (raw.includes('cisco') || raw.includes('tandberg')) vendor = 'Cisco'
      else if (raw.includes('poly') || raw.includes('polycom')) vendor = 'Poly'
      else if (raw.includes('pexip')) vendor = 'Pexip'
      else if (raw.includes('chrome') || raw.includes('firefox') || raw.includes('safari') || raw.includes('edge') || raw.includes('mozilla')) vendor = 'Browser'
      else if (raw.includes('teams') || raw.includes('microsoft') || raw.includes('skype')) vendor = 'Microsoft'
      else if (raw.includes('zoom')) vendor = 'Zoom'
      else if (raw.includes('logitech')) vendor = 'Logitech'
      else vendor = p.vendor ?? 'Unknown'
      vendorCounts[vendor] = (vendorCounts[vendor] ?? 0) + 1
    }
    const vendorBreakdown = Object.entries(vendorCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // 3. Top users (by join frequency)
    const allParticipants = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        name: { not: null },
        conference: excludeFilter,
      },
      select: { name: true, duration: true },
    })

    const userStats: Record<string, { count: number; totalDuration: number }> = {}
    for (const p of allParticipants) {
      const name = p.name ?? 'Unknown'
      if (!userStats[name]) userStats[name] = { count: 0, totalDuration: 0 }
      userStats[name].count++
      userStats[name].totalDuration += p.duration ?? 0
    }
    const topUsers = Object.entries(userStats)
      .map(([name, stats]) => ({ name, count: stats.count, totalDuration: Math.round(stats.totalDuration) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // 4. Call direction breakdown
    const participantsWithDirection = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        callDirection: { not: null },
        conference: excludeFilter,
      },
      select: { callDirection: true },
    })

    const directionCounts: Record<string, number> = {}
    for (const p of participantsWithDirection) {
      const dir = p.callDirection ?? 'Unknown'
      directionCounts[dir] = (directionCounts[dir] ?? 0) + 1
    }
    const callDirectionBreakdown = Object.entries(directionCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // 5. Encryption compliance
    const participantsWithEncryption = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        conference: excludeFilter,
      },
      select: { encryption: true },
    })

    let encrypted = 0
    let unencrypted = 0
    let encryptionUnknown = 0
    for (const p of participantsWithEncryption) {
      const enc = (p.encryption ?? '').toLowerCase()
      if (enc === 'on' || enc === 'true' || enc === 'yes' || enc === 'encrypted') encrypted++
      else if (enc === 'off' || enc === 'false' || enc === 'no' || enc === 'unencrypted') unencrypted++
      else encryptionUnknown++
    }
    const encryptionBreakdown = [
      { name: 'Encrypted', value: encrypted },
      { name: 'Unencrypted', value: unencrypted },
      ...(encryptionUnknown > 0 ? [{ name: 'Unknown', value: encryptionUnknown }] : []),
    ]

    // 6. Peak concurrent usage per day
    const conferences = await prisma.conference.findMany({
      where: {
        startTime: { gte: thirtyDaysAgo },
        ...excludeFilter,
      },
      select: { startTime: true, endTime: true },
    })

    const participants = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        conference: excludeFilter,
      },
      select: { joinTime: true, leaveTime: true },
    })

    // Calculate peak concurrency per day using an event-based sweep
    const peakConcurrency = calculatePeakConcurrency(conferences, participants)

    // 7. Conference duration distribution
    const completedConferences = await prisma.conference.findMany({
      where: {
        startTime: { gte: thirtyDaysAgo },
        endTime: { not: null },
        ...excludeFilter,
      },
      select: { startTime: true, endTime: true },
    })

    const durationBuckets: Record<string, number> = {
      '<5m': 0,
      '5-15m': 0,
      '15-30m': 0,
      '30-60m': 0,
      '1-2h': 0,
      '2-4h': 0,
      '>4h': 0,
    }
    for (const c of completedConferences) {
      const durationMin = (new Date(c.endTime!).getTime() - new Date(c.startTime).getTime()) / 60000
      if (durationMin < 5) durationBuckets['<5m']++
      else if (durationMin < 15) durationBuckets['5-15m']++
      else if (durationMin < 30) durationBuckets['15-30m']++
      else if (durationMin < 60) durationBuckets['30-60m']++
      else if (durationMin < 120) durationBuckets['1-2h']++
      else if (durationMin < 240) durationBuckets['2-4h']++
      else durationBuckets['>4h']++
    }
    const durationDistribution = Object.entries(durationBuckets).map(([name, value]) => ({ name, value }))

    // 8. Disconnect reason analysis
    const participantsWithDisconnect = await prisma.participant.findMany({
      where: {
        joinTime: { gte: thirtyDaysAgo },
        disconnectReason: { not: null },
        conference: excludeFilter,
      },
      select: { disconnectReason: true },
    })

    const disconnectCounts: Record<string, number> = {}
    for (const p of participantsWithDisconnect) {
      const reason = p.disconnectReason ?? 'Unknown'
      disconnectCounts[reason] = (disconnectCounts[reason] ?? 0) + 1
    }
    const disconnectReasons = Object.entries(disconnectCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)

    return NextResponse.json({
      protocolBreakdown,
      vendorBreakdown,
      topUsers,
      callDirectionBreakdown,
      encryptionBreakdown,
      peakConcurrency,
      durationDistribution,
      disconnectReasons,
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 })
  }
}

function calculatePeakConcurrency(
  conferences: { startTime: Date; endTime: Date | null }[],
  participants: { joinTime: Date; leaveTime: Date | null }[]
): { date: string; peakConferences: number; peakParticipants: number }[] {
  const dayMap: Record<string, { peakConf: number; peakPart: number }> = {}
  for (let i = 0; i < 30; i++) {
    const d = subDays(new Date(), 29 - i)
    dayMap[format(d, 'yyyy-MM-dd')] = { peakConf: 0, peakPart: 0 }
  }

  // Group events by day and compute peak for each day
  const confByDay: Record<string, { start: number; end: number }[]> = {}
  for (const c of conferences) {
    const day = format(new Date(c.startTime), 'yyyy-MM-dd')
    if (!(day in dayMap)) continue
    if (!confByDay[day]) confByDay[day] = []
    confByDay[day].push({
      start: new Date(c.startTime).getTime(),
      end: c.endTime ? new Date(c.endTime).getTime() : Date.now(),
    })
  }

  const partByDay: Record<string, { start: number; end: number }[]> = {}
  for (const p of participants) {
    const day = format(new Date(p.joinTime), 'yyyy-MM-dd')
    if (!(day in dayMap)) continue
    if (!partByDay[day]) partByDay[day] = []
    partByDay[day].push({
      start: new Date(p.joinTime).getTime(),
      end: p.leaveTime ? new Date(p.leaveTime).getTime() : Date.now(),
    })
  }

  for (const day of Object.keys(dayMap)) {
    dayMap[day].peakConf = peakFromIntervals(confByDay[day] ?? [])
    dayMap[day].peakPart = peakFromIntervals(partByDay[day] ?? [])
  }

  return Object.entries(dayMap).map(([date, { peakConf, peakPart }]) => ({
    date,
    peakConferences: peakConf,
    peakParticipants: peakPart,
  }))
}

function peakFromIntervals(intervals: { start: number; end: number }[]): number {
  if (intervals.length === 0) return 0
  const events: { time: number; delta: number }[] = []
  for (const iv of intervals) {
    events.push({ time: iv.start, delta: 1 })
    events.push({ time: iv.end, delta: -1 })
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta)
  let current = 0
  let peak = 0
  for (const e of events) {
    current += e.delta
    if (current > peak) peak = current
  }
  return peak
}
