import { prisma } from '@/lib/prisma'
import { addDays, format, startOfDay } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

export interface ReportKpis {
  uniqueVmrs: number
  totalConferences: number
  totalParticipants: number
  totalMeetingHours: number
}

export interface PeakConcurrencyPoint {
  date: string
  peakParticipants: number
}

export interface TopVmr {
  name: string
  calls: number
  totalDurationSeconds: number
  participants: number
}

export interface TopParticipant {
  name: string
  alias: string | null
  calls: number
  totalDurationSeconds: number
}

export interface QualitySummary {
  total: number
  good: number
  ok: number
  bad: number
  terrible: number
  unknown: number
  goodPct: number
  okPct: number
  badPct: number
  terriblePct: number
  avgPacketLossPct: number | null
  avgJitterMs: number | null
}

export interface ReportData {
  period: { start: string; end: string }
  kpis: ReportKpis
  peakConcurrency: PeakConcurrencyPoint[]
  peakValue: number
  peakDate: string | null
  topVmrs: TopVmr[]
  topParticipants: TopParticipant[]
  quality: QualitySummary
  narrative: string
}

const IDENTIFIER_PROTOCOL_PREFIX = /^(sip|sips|h323|teams|msteams|ms-teams|mailto):/i

function cleanIdentifier(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const bracketMatch = trimmed.match(/<([^>]+)>/)
  const inner = bracketMatch?.[1] ?? trimmed
  const withoutProtocol = inner.replace(IDENTIFIER_PROTOCOL_PREFIX, '')
  const normalized = withoutProtocol.split(';')[0].trim().replace(/^['"]|['"]$/g, '')
  return normalized || null
}

function cleanDisplayName(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return null
  return trimmed
}

function getParticipantLabel(p: {
  name: string | null
  identity: string | null
  sourceAlias: string | null
  destinationAlias: string | null
  remoteAddress: string | null
  callUuid: string | null
}): string {
  const displayName = cleanDisplayName(p.name)
  const alias =
    cleanIdentifier(p.sourceAlias) ??
    cleanIdentifier(p.identity) ??
    cleanIdentifier(p.destinationAlias)
  return displayName ?? alias ?? cleanIdentifier(p.remoteAddress) ?? p.callUuid ?? 'Unknown'
}

function getGroupingKey(p: {
  name: string | null
  identity: string | null
  sourceAlias: string | null
  destinationAlias: string | null
  remoteAddress: string | null
  callUuid: string | null
}, label: string): string {
  const alias =
    cleanIdentifier(p.sourceAlias) ??
    cleanIdentifier(p.identity) ??
    cleanIdentifier(p.destinationAlias)
  if (alias) return alias.toLowerCase()
  const displayName = cleanDisplayName(p.name)
  if (displayName) return displayName.toLowerCase()
  return (cleanIdentifier(p.remoteAddress) ?? p.callUuid ?? label).toLowerCase()
}

type TimeInterval = { start: number; end: number }

function peakFromIntervals(intervals: TimeInterval[]): number {
  if (intervals.length === 0) return 0
  const events: { time: number; delta: number }[] = []
  for (const { start, end } of intervals) {
    events.push({ time: start, delta: 1 })
    events.push({ time: end, delta: -1 })
  }
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    return a.delta - b.delta
  })
  let current = 0
  let peak = 0
  for (const ev of events) {
    current += ev.delta
    if (current > peak) peak = current
  }
  return peak
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function generateNarrative(data: Omit<ReportData, 'narrative'>): string {
  const { kpis, peakValue, peakDate, quality, period } = data
  const startStr = new Date(period.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const endStr = new Date(period.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const goodPct = quality.goodPct
  const qualityLabel =
    goodPct >= 85 ? 'excellent' : goodPct >= 70 ? 'good' : goodPct >= 50 ? 'fair' : 'poor'

  const peakStr = peakDate
    ? ` The busiest day was ${new Date(peakDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} with a peak of ${peakValue} concurrent participant${peakValue !== 1 ? 's' : ''}.`
    : peakValue > 0
      ? ` Peak concurrent participants reached ${peakValue}.`
      : ''

  const hoursStr =
    kpis.totalMeetingHours > 0
      ? ` totalling ${formatHours(kpis.totalMeetingHours * 3600)}`
      : ''

  const qualityStr =
    quality.total > 0
      ? ` Overall call quality was ${qualityLabel}, with ${goodPct.toFixed(0)}% of measured calls rated as good.`
      : ''

  return `During the period from ${startStr} to ${endStr}, ${kpis.uniqueVmrs} Virtual Meeting Room${kpis.uniqueVmrs !== 1 ? 's' : ''} were active across ${kpis.totalConferences} meeting${kpis.totalConferences !== 1 ? 's' : ''}${hoursStr}, involving ${kpis.totalParticipants} participant session${kpis.totalParticipants !== 1 ? 's' : ''}.${peakStr}${qualityStr}`
}

export async function fetchReportData(startDate: Date, endDate: Date): Promise<ReportData> {
  const windowStart = startOfDay(startDate)
  // windowEnd is exclusive: the day after endDate
  const windowEnd = addDays(startOfDay(endDate), 1)

  const excludedIds = await getShortConferenceIds()
  const excludeFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

  // Calculate number of days for the concurrency chart
  const windowDays = Math.max(
    1,
    Math.round((windowEnd.getTime() - windowStart.getTime()) / (24 * 3600 * 1000))
  )

  const [conferences, participantIntervals, qualityRows, mediaStreams] = await Promise.all([
    prisma.conference.findMany({
      where: {
        startTime: { gte: windowStart, lt: windowEnd },
        ...excludeFilter,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        vmrId: true,
        vmr: { select: { name: true } },
        _count: { select: { participants: true } },
        participants: {
          select: {
            id: true,
            name: true,
            identity: true,
            sourceAlias: true,
            destinationAlias: true,
            remoteAddress: true,
            callUuid: true,
            joinTime: true,
            leaveTime: true,
            duration: true,
            callQuality: true,
          },
        },
      },
    }),
    // For concurrency we need participants that were active DURING the window
    prisma.participant.findMany({
      where: {
        joinTime: { lt: windowEnd },
        OR: [{ leaveTime: null }, { leaveTime: { gte: windowStart } }],
        conference: { startTime: { gte: windowStart, lt: windowEnd }, ...excludeFilter },
      },
      select: {
        joinTime: true,
        leaveTime: true,
        conference: { select: { endTime: true } },
      },
    }),
    prisma.participant.findMany({
      where: {
        leaveTime: { not: null },
        callQuality: { not: null },
        joinTime: { gte: windowStart, lt: windowEnd },
        conference: { startTime: { gte: windowStart, lt: windowEnd }, ...excludeFilter },
      },
      select: { callQuality: true },
    }),
    prisma.mediaStream.findMany({
      where: {
        participant: {
          joinTime: { gte: windowStart, lt: windowEnd },
          conference: { startTime: { gte: windowStart, lt: windowEnd }, ...excludeFilter },
        },
      },
      select: {
        rxPacketLoss: true,
        txPacketLoss: true,
        rxJitter: true,
        txJitter: true,
      },
    }),
  ])

  // --- KPIs ---
  const uniqueVmrIds = new Set(conferences.map((c) => c.vmrId))
  const totalConferences = conferences.length
  const allParticipants = conferences.flatMap((c) => c.participants)
  const totalParticipants = allParticipants.length

  const now = new Date()
  let totalDurationSecs = 0
  for (const p of allParticipants) {
    const effectiveEnd = p.leaveTime ?? now
    const derived = (effectiveEnd.getTime() - p.joinTime.getTime()) / 1000
    const recorded = typeof p.duration === 'number' && p.duration > 0 ? p.duration : 0
    totalDurationSecs += Math.max(recorded, derived > 0 ? derived : 0)
  }
  const totalMeetingHours = Math.round((totalDurationSecs / 3600) * 10) / 10

  // --- Peak Concurrency ---
  const dayMap: Record<string, TimeInterval[]> = {}
  for (let i = 0; i < windowDays; i++) {
    const day = addDays(windowStart, i)
    dayMap[format(day, 'yyyy-MM-dd')] = []
  }

  for (const { joinTime, leaveTime, conference } of participantIntervals) {
    const effectiveEnd = leaveTime ?? conference.endTime ?? windowEnd
    const effectiveStart = Math.max(joinTime.getTime(), windowStart.getTime())
    const effectiveEndTs = Math.min(effectiveEnd.getTime(), windowEnd.getTime())
    if (effectiveEndTs <= effectiveStart) continue

    let dayStart = startOfDay(new Date(effectiveStart))
    while (dayStart.getTime() < effectiveEndTs) {
      const nextDay = addDays(dayStart, 1)
      const dayKey = format(dayStart, 'yyyy-MM-dd')
      const clippedStart = Math.max(effectiveStart, dayStart.getTime())
      const clippedEnd = Math.min(effectiveEndTs, nextDay.getTime())
      if (dayKey in dayMap && clippedEnd > clippedStart) {
        dayMap[dayKey].push({ start: clippedStart, end: clippedEnd })
      }
      dayStart = nextDay
    }
  }

  const peakConcurrency: PeakConcurrencyPoint[] = Object.entries(dayMap).map(([date, intervals]) => ({
    date,
    peakParticipants: peakFromIntervals(intervals),
  }))

  const peakValue = peakConcurrency.reduce((max, p) => Math.max(max, p.peakParticipants), 0)
  const peakPoint = peakConcurrency.reduce<PeakConcurrencyPoint | null>((best, p) => {
    if (!best) return p
    return p.peakParticipants > best.peakParticipants ? p : best
  }, null)
  const peakDate = peakPoint?.peakParticipants && peakPoint.peakParticipants > 0 ? peakPoint.date : null

  // --- Top VMRs ---
  const vmrMap: Record<string, { name: string; calls: number; durationSecs: number; participants: number }> = {}
  for (const conf of conferences) {
    const name = conf.vmr.name
    if (!vmrMap[name]) vmrMap[name] = { name, calls: 0, durationSecs: 0, participants: 0 }
    vmrMap[name].calls++
    vmrMap[name].participants += conf._count.participants
    if (conf.endTime) {
      const dur = (conf.endTime.getTime() - conf.startTime.getTime()) / 1000
      if (dur > 0) vmrMap[name].durationSecs += dur
    }
  }
  const topVmrs: TopVmr[] = Object.values(vmrMap)
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10)
    .map((v) => ({ name: v.name, calls: v.calls, totalDurationSeconds: Math.round(v.durationSecs), participants: v.participants }))

  // --- Top Participants ---
  const participantMap: Record<string, {
    name: string
    alias: string | null
    conferenceIds: Set<number>
    sessionCount: number
    totalDuration: number
  }> = {}

  for (const p of allParticipants) {
    const label = getParticipantLabel(p)
    const alias =
      cleanIdentifier(p.sourceAlias) ??
      cleanIdentifier(p.identity) ??
      cleanIdentifier(p.destinationAlias)
    const key = getGroupingKey(p, label)
    const effectiveEnd = p.leaveTime ?? now
    const derived = (effectiveEnd.getTime() - p.joinTime.getTime()) / 1000
    const recorded = typeof p.duration === 'number' && p.duration > 0 ? p.duration : 0
    const dur = Math.max(recorded, derived > 0 ? derived : 0)

    const conferenceId = conferences.find((c) => c.participants.some((pp) => pp.id === p.id))?.id

    if (!participantMap[key]) {
      participantMap[key] = { name: label, alias: alias !== label ? alias : null, conferenceIds: new Set(), sessionCount: 0, totalDuration: 0 }
    }
    const entry = participantMap[key]
    entry.sessionCount++
    if (conferenceId !== undefined) entry.conferenceIds.add(conferenceId)
    entry.totalDuration += dur
    const dn = cleanDisplayName(p.name)
    if (dn) entry.name = dn
  }

  const topParticipants: TopParticipant[] = Object.values(participantMap)
    .sort((a, b) => b.sessionCount - a.sessionCount || b.totalDuration - a.totalDuration)
    .slice(0, 10)
    .map((e) => ({
      name: e.name,
      alias: e.alias,
      calls: e.conferenceIds.size || e.sessionCount,
      totalDurationSeconds: Math.round(e.totalDuration),
    }))

  // --- Quality ---
  const quality: QualitySummary = {
    total: qualityRows.length,
    good: 0, ok: 0, bad: 0, terrible: 0, unknown: 0,
    goodPct: 0, okPct: 0, badPct: 0, terriblePct: 0,
    avgPacketLossPct: null,
    avgJitterMs: null,
  }
  for (const row of qualityRows) {
    const q = row.callQuality ?? ''
    if (q.includes('good')) quality.good++
    else if (q.includes('ok')) quality.ok++
    else if (q.includes('bad')) quality.bad++
    else if (q.includes('terrible')) quality.terrible++
    else quality.unknown++
  }
  if (quality.total > 0) {
    quality.goodPct = (quality.good / quality.total) * 100
    quality.okPct = (quality.ok / quality.total) * 100
    quality.badPct = (quality.bad / quality.total) * 100
    quality.terriblePct = (quality.terrible / quality.total) * 100
  }

  const packetLossValues: number[] = []
  const jitterValues: number[] = []
  for (const ms of mediaStreams) {
    if (ms.rxPacketLoss !== null && ms.rxPacketLoss >= 0) packetLossValues.push(ms.rxPacketLoss)
    if (ms.txPacketLoss !== null && ms.txPacketLoss >= 0) packetLossValues.push(ms.txPacketLoss)
    if (ms.rxJitter !== null && ms.rxJitter >= 0) jitterValues.push(ms.rxJitter)
    if (ms.txJitter !== null && ms.txJitter >= 0) jitterValues.push(ms.txJitter)
  }
  if (packetLossValues.length > 0) {
    quality.avgPacketLossPct = Math.round((packetLossValues.reduce((a, b) => a + b, 0) / packetLossValues.length) * 100) / 100
  }
  if (jitterValues.length > 0) {
    quality.avgJitterMs = Math.round(jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length)
  }

  const base: Omit<ReportData, 'narrative'> = {
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    kpis: { uniqueVmrs: uniqueVmrIds.size, totalConferences, totalParticipants, totalMeetingHours },
    peakConcurrency,
    peakValue,
    peakDate,
    topVmrs,
    topParticipants,
    quality,
  }

  return { ...base, narrative: generateNarrative(base) }
}
