export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

const DEFAULT_WINDOW_DAYS = 30
const MAX_WINDOW_DAYS = 365
const IDENTIFIER_PROTOCOL_PREFIX = /^(sip|sips|h323|teams|msteams|ms-teams|mailto):/i

type BreakdownItem = { name: string; value: number }
type PeakConcurrencyPoint = { date: string; peakParticipants: number }
type TimeInterval = { start: number; end: number }

type AnalyticsParticipant = {
  conferenceId: number
  name: string | null
  identity: string | null
  sourceAlias: string | null
  destinationAlias: string | null
  remoteAddress: string | null
  callUuid: string | null
  joinTime: Date
  leaveTime: Date | null
  duration: number | null
  protocol: string | null
  vendor: string | null
  callDirection: string | null
  encryption: string | null
  disconnectReason: string | null
  conferenceEndTime: Date | null
}

export async function GET(request: Request) {
  try {
    const windowDays = getWindowDays(new URL(request.url).searchParams.get('days'))
    const now = new Date()
    const windowStart = startOfDay(subDays(now, windowDays - 1))
    const windowEnd = addDays(startOfDay(now), 1)
    const excludedIds = await getShortConferenceIds()
    const excludeConferenceFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    const [participantsInWindow, participantIntervals, conferencesInWindow] = await Promise.all([
      prisma.participant.findMany({
        where: {
          joinTime: { gte: windowStart, lt: windowEnd },
          conference: excludeConferenceFilter,
        },
        select: {
          conferenceId: true,
          name: true,
          identity: true,
          sourceAlias: true,
          destinationAlias: true,
          remoteAddress: true,
          callUuid: true,
          joinTime: true,
          leaveTime: true,
          duration: true,
          protocol: true,
          vendor: true,
          callDirection: true,
          encryption: true,
          disconnectReason: true,
          conference: {
            select: {
              endTime: true,
            },
          },
        },
      }),
      prisma.participant.findMany({
        where: {
          joinTime: { lt: windowEnd },
          OR: [{ leaveTime: null }, { leaveTime: { gte: windowStart } }],
          conference: excludeConferenceFilter,
        },
        select: {
          joinTime: true,
          leaveTime: true,
          conference: {
            select: {
              endTime: true,
            },
          },
        },
      }),
      prisma.conference.findMany({
        where: {
          startTime: { gte: windowStart, lt: windowEnd },
          ...excludeConferenceFilter,
        },
        select: {
          startTime: true,
          endTime: true,
          vmr: { select: { name: true } },
          _count: { select: { participants: true } },
        },
      }),
    ])

    const normalizedParticipantsInWindow = participantsInWindow.map(({ conference, ...participant }) => ({
      ...participant,
      conferenceEndTime: conference.endTime,
    }))
    const normalizedParticipantIntervals = participantIntervals.map(({ conference, ...participant }) => ({
      ...participant,
      conferenceEndTime: conference.endTime,
    }))

    const protocolBreakdown = buildSortedBreakdown(normalizedParticipantsInWindow, (participant) => participant.protocol ?? 'Unknown')
    const vendorBreakdown = buildSortedBreakdown(normalizedParticipantsInWindow, (participant) => normalizeVendor(participant.vendor))
    const callDirectionBreakdown = buildSortedBreakdown(normalizedParticipantsInWindow, (participant) => participant.callDirection ?? 'Unknown')
    const disconnectReasons = buildSortedBreakdown(
      normalizedParticipantsInWindow.filter((participant) => participant.disconnectReason),
      (participant) => participant.disconnectReason ?? 'Unknown'
    ).slice(0, 15)

    const encryptionBreakdown = buildEncryptionBreakdown(normalizedParticipantsInWindow)
    const topParticipants = buildTopParticipants(normalizedParticipantsInWindow, now)
    const peakConcurrency = calculatePeakConcurrency(normalizedParticipantIntervals, windowStart, windowEnd, windowDays)
    const durationDistribution = buildDurationDistribution(conferencesInWindow)
    const conferenceActivity = buildConferenceActivity(conferencesInWindow, windowStart, windowDays)
    const topVmrs = buildTopVmrs(conferencesInWindow)

    const peakParticipants = peakConcurrency.reduce((max, point) => Math.max(max, point.peakParticipants), 0)
    const busiestDay = peakConcurrency.reduce<PeakConcurrencyPoint | null>((best, point) => {
      if (!best) return point
      if (point.peakParticipants > best.peakParticipants) return point
      return best
    }, null)

    const averageParticipantsPerConference = conferencesInWindow.length > 0
      ? roundToSingleDecimal(participantsInWindow.length / conferencesInWindow.length)
      : 0
    const averageConferenceDuration = averageDurationSeconds(conferencesInWindow)
    const largestConference = conferencesInWindow.reduce((max, conference) => Math.max(max, conference._count.participants), 0)
    const encryptedCount = encryptionBreakdown.find((item) => item.name === 'Encrypted')?.value ?? 0
    const unencryptedCount = encryptionBreakdown.find((item) => item.name === 'Unencrypted')?.value ?? 0
    const encryptedShare = encryptedCount + unencryptedCount > 0
      ? Math.round((encryptedCount / (encryptedCount + unencryptedCount)) * 100)
      : null

    return NextResponse.json({
      windowDays,
      summary: {
        totalConferences: conferencesInWindow.length,
        totalParticipantSessions: participantsInWindow.length,
        uniqueParticipants: topParticipants.length,
        peakParticipants,
        averageParticipantsPerConference,
        averageConferenceDuration,
        largestConference,
        encryptedShare,
      },
      insights: buildInsights({
        busiestDay,
        peakParticipants,
        encryptedShare,
        topProtocol: protocolBreakdown[0]?.name ?? null,
        topVendor: vendorBreakdown[0]?.name ?? null,
        averageParticipantsPerConference,
        windowDays,
      }),
      conferenceActivity,
      topVmrs,
      protocolBreakdown,
      vendorBreakdown,
      topParticipants,
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

function buildSortedBreakdown<T>(items: T[], getName: (item: T) => string): BreakdownItem[] {
  const counts: Record<string, number> = {}

  for (const item of items) {
    const name = getName(item).trim() || 'Unknown'
    counts[name] = (counts[name] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function normalizeVendor(vendor: string | null): string {
  const raw = (vendor ?? 'Unknown').toLowerCase()
  if (!raw || raw === 'unknown') return 'Unknown'
  if (raw.includes('cisco') || raw.includes('tandberg')) return 'Cisco'
  if (raw.includes('poly') || raw.includes('polycom')) return 'Poly'
  if (raw.includes('pexip')) return 'Pexip'
  if (raw.includes('chrome') || raw.includes('firefox') || raw.includes('safari') || raw.includes('edge') || raw.includes('mozilla')) return 'Browser'
  if (raw.includes('teams') || raw.includes('microsoft') || raw.includes('skype')) return 'Microsoft'
  if (raw.includes('zoom')) return 'Zoom'
  if (raw.includes('logitech')) return 'Logitech'
  return vendor?.trim() || 'Other'
}

function buildEncryptionBreakdown(participants: Pick<AnalyticsParticipant, 'encryption'>[]): BreakdownItem[] {
  let encrypted = 0
  let unencrypted = 0
  let unknown = 0

  for (const participant of participants) {
    const encryption = (participant.encryption ?? '').toLowerCase()
    if (encryption === 'on' || encryption === 'true' || encryption === 'yes' || encryption === 'encrypted') encrypted++
    else if (encryption === 'off' || encryption === 'false' || encryption === 'no' || encryption === 'unencrypted') unencrypted++
    else unknown++
  }

  return [
    { name: 'Encrypted', value: encrypted },
    { name: 'Unencrypted', value: unencrypted },
    ...(unknown > 0 ? [{ name: 'Unknown', value: unknown }] : []),
  ]
}

function buildTopParticipants(participants: AnalyticsParticipant[], referenceTime: Date) {
  const participantMap: Record<string, {
    name: string
    secondaryLabel: string | null
    conferenceIds: Set<number>
    sessionCount: number
    totalDuration: number
  }> = {}

  for (const participant of participants) {
    const preferredLabel = getParticipantPrimaryLabel(participant)
    const secondaryLabel = getParticipantSecondaryLabel(participant, preferredLabel)
    const key = getParticipantGroupingKey(participant, preferredLabel)
    const duration = participantDurationSeconds(participant, referenceTime)

    if (!participantMap[key]) {
      participantMap[key] = {
        name: preferredLabel,
        secondaryLabel,
        conferenceIds: new Set<number>(),
        sessionCount: 0,
        totalDuration: 0,
      }
    }

    const entry = participantMap[key]
    entry.sessionCount++
    entry.conferenceIds.add(participant.conferenceId)
    entry.totalDuration += duration

    const displayName = cleanDisplayName(participant.name)
    if (displayName) {
      entry.name = displayName
    }
    if (!entry.secondaryLabel && secondaryLabel) {
      entry.secondaryLabel = secondaryLabel
    }
  }

  return Object.values(participantMap)
    .map((entry) => ({
      name: entry.name,
      secondaryLabel: entry.secondaryLabel,
      conferenceCount: entry.conferenceIds.size,
      sessionCount: entry.sessionCount,
      totalDuration: Math.round(entry.totalDuration),
      averageDuration: entry.sessionCount > 0 ? Math.round(entry.totalDuration / entry.sessionCount) : 0,
    }))
    .sort((a, b) => {
      if (b.conferenceCount !== a.conferenceCount) return b.conferenceCount - a.conferenceCount
      if (b.totalDuration !== a.totalDuration) return b.totalDuration - a.totalDuration
      return b.sessionCount - a.sessionCount
    })
    .slice(0, 15)
}

function getParticipantPrimaryLabel(participant: Pick<AnalyticsParticipant, 'name' | 'identity' | 'sourceAlias' | 'destinationAlias' | 'remoteAddress' | 'callUuid'>): string {
  const displayName = cleanDisplayName(participant.name)
  const alias = cleanIdentifier(participant.sourceAlias) ?? cleanIdentifier(participant.identity) ?? cleanIdentifier(participant.destinationAlias)
  return displayName ?? alias ?? cleanIdentifier(participant.remoteAddress) ?? participant.callUuid ?? 'Unknown participant'
}

function getParticipantSecondaryLabel(
  participant: Pick<AnalyticsParticipant, 'identity' | 'sourceAlias' | 'destinationAlias'>,
  primaryLabel: string,
): string | null {
  const alias = cleanIdentifier(participant.sourceAlias) ?? cleanIdentifier(participant.identity) ?? cleanIdentifier(participant.destinationAlias)
  if (!alias) return null
  return alias.toLowerCase() === primaryLabel.toLowerCase() ? null : alias
}

function getParticipantGroupingKey(
  participant: Pick<AnalyticsParticipant, 'name' | 'identity' | 'sourceAlias' | 'destinationAlias' | 'remoteAddress' | 'callUuid'>,
  fallbackLabel: string,
): string {
  const alias = cleanIdentifier(participant.sourceAlias) ?? cleanIdentifier(participant.identity) ?? cleanIdentifier(participant.destinationAlias)
  if (alias) return alias.toLowerCase()

  const displayName = cleanDisplayName(participant.name)
  if (displayName) return displayName.toLowerCase()

  return (cleanIdentifier(participant.remoteAddress) ?? participant.callUuid ?? fallbackLabel).toLowerCase()
}

function cleanDisplayName(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return null
  return trimmed
}

function cleanIdentifier(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const bracketMatch = trimmed.match(/<([^>]+)>/)
  const innerValue = bracketMatch?.[1] ?? trimmed
  const withoutProtocol = innerValue.replace(IDENTIFIER_PROTOCOL_PREFIX, '')
  const normalized = withoutProtocol.split(';')[0].trim().replace(/^['"]|['"]$/g, '')

  return normalized || null
}

function participantDurationSeconds(
  participant: Pick<AnalyticsParticipant, 'duration' | 'joinTime' | 'leaveTime' | 'conferenceEndTime'>,
  referenceTime: Date,
): number {
  const effectiveEnd = effectiveParticipantEndTime(participant, referenceTime)
  const derived = (effectiveEnd.getTime() - participant.joinTime.getTime()) / 1000
  const derivedDuration = derived > 0 ? derived : 0
  const storedDuration = typeof participant.duration === 'number' && participant.duration > 0 ? participant.duration : 0
  return Math.max(storedDuration, derivedDuration)
}

function effectiveParticipantEndTime(
  participant: Pick<AnalyticsParticipant, 'leaveTime' | 'conferenceEndTime'>,
  fallbackEndTime: Date,
): Date {
  // History data can be missing participant leave times even when the conference itself has ended.
  // Prefer the participant leave time when present, otherwise fall back to the conference end,
  // and only use the supplied fallback for still-active calls.
  return participant.leaveTime ?? participant.conferenceEndTime ?? fallbackEndTime
}

function buildDurationDistribution(conferences: { startTime: Date; endTime: Date | null }[]): BreakdownItem[] {
  const buckets: Record<string, number> = {
    '<5m': 0,
    '5-15m': 0,
    '15-30m': 0,
    '30-60m': 0,
    '1-2h': 0,
    '2-4h': 0,
    '>4h': 0,
  }

  for (const conference of conferences) {
    if (!conference.endTime) continue
    const durationMinutes = (conference.endTime.getTime() - conference.startTime.getTime()) / 60000
    if (durationMinutes < 0) continue
    if (durationMinutes < 5) buckets['<5m']++
    else if (durationMinutes < 15) buckets['5-15m']++
    else if (durationMinutes < 30) buckets['15-30m']++
    else if (durationMinutes < 60) buckets['30-60m']++
    else if (durationMinutes < 120) buckets['1-2h']++
    else if (durationMinutes < 240) buckets['2-4h']++
    else buckets['>4h']++
  }

  return Object.entries(buckets).map(([name, value]) => ({ name, value }))
}

function buildConferenceActivity(conferences: { startTime: Date }[], windowStart: Date, windowDays: number) {
  const dayMap: Record<string, number> = {}

  for (let index = 0; index < windowDays; index++) {
    const day = addDays(windowStart, index)
    dayMap[format(day, 'yyyy-MM-dd')] = 0
  }

  for (const conference of conferences) {
    const dayKey = format(conference.startTime, 'yyyy-MM-dd')
    if (dayKey in dayMap) dayMap[dayKey]++
  }

  return Object.entries(dayMap).map(([date, count]) => ({ date, count }))
}

function buildTopVmrs(conferences: { vmr: { name: string } }[]): BreakdownItem[] {
  const counts: Record<string, number> = {}

  for (const conference of conferences) {
    counts[conference.vmr.name] = (counts[conference.vmr.name] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

function averageDurationSeconds(conferences: { startTime: Date; endTime: Date | null }[]): number {
  const completed = conferences
    .filter((conference) => conference.endTime)
    .map((conference) => (conference.endTime!.getTime() - conference.startTime.getTime()) / 1000)
    .filter((duration) => duration > 0)

  if (completed.length === 0) return 0

  const total = completed.reduce((sum, duration) => sum + duration, 0)
  return Math.round(total / completed.length)
}

function buildInsights({
  busiestDay,
  peakParticipants,
  encryptedShare,
  topProtocol,
  topVendor,
  averageParticipantsPerConference,
  windowDays,
}: {
  busiestDay: PeakConcurrencyPoint | null
  peakParticipants: number
  encryptedShare: number | null
  topProtocol: string | null
  topVendor: string | null
  averageParticipantsPerConference: number
  windowDays: number
}) {
  const insights: { title: string; value: string; description: string }[] = []

  if (peakParticipants > 0) {
    insights.push({
      title: 'Capacity planning',
      value: `Peak ${peakParticipants} participants`,
      description: busiestDay
        ? `The busiest day reached ${busiestDay.peakParticipants} concurrent participants on ${format(new Date(busiestDay.date), 'MMM d')}. Keep headroom above that peak when sizing ports and node capacity.`
        : 'Use the peak concurrent participant value as the baseline for capacity planning, then leave buffer for unexpected spikes.',
    })
  }

  if (topProtocol || topVendor) {
    const value = [topProtocol, topVendor].filter(Boolean).join(' • ') || 'Mixed endpoint estate'
    insights.push({
      title: 'Endpoint focus',
      value,
      description: `The last ${windowDays} days are dominated by ${topProtocol ?? 'mixed protocols'}${topVendor ? ` and ${topVendor} endpoints` : ''}. Prioritize testing and troubleshooting around that client mix.`,
    })
  }

  if (encryptedShare !== null) {
    insights.push(
      encryptedShare === 100
        ? {
            title: 'Encryption posture',
            value: '100% encrypted',
            description: 'All participant legs with a reported encryption state were encrypted. Keep interop policies aligned so that new gateway paths do not lower that baseline.',
          }
        : {
            title: 'Encryption posture',
            value: `${encryptedShare}% encrypted`,
            description: 'Some participant legs were reported as unencrypted. Review gateway and interop profiles for the unencrypted paths surfaced in the analytics data.',
          }
    )
  }

  if (averageParticipantsPerConference > 0 && insights.length < 4) {
    insights.push({
      title: 'Meeting pattern',
      value: `${averageParticipantsPerConference} participants / conference`,
      description: 'Use the average conference size together with the peak chart to decide whether capacity planning should optimize for many small meetings or a few larger ones.',
    })
  }

  return insights.slice(0, 4)
}

function calculatePeakConcurrency(
  participants: { joinTime: Date; leaveTime: Date | null; conferenceEndTime: Date | null }[],
  windowStart: Date,
  windowEnd: Date,
  windowDays: number,
): PeakConcurrencyPoint[] {
  const dayMap: Record<string, { participants: TimeInterval[] }> = {}

  for (let index = 0; index < windowDays; index++) {
    const day = addDays(windowStart, index)
    dayMap[format(day, 'yyyy-MM-dd')] = { participants: [] }
  }

  for (const participant of participants) {
    addIntervalToDayMap(
      dayMap,
      participant.joinTime,
      effectiveParticipantEndTime(participant, windowEnd),
      windowStart,
      windowEnd,
      'participants',
    )
  }

  return Object.entries(dayMap).map(([date, value]) => ({
    date,
    peakParticipants: peakFromIntervals(value.participants),
  }))
}

function addIntervalToDayMap(
  dayMap: Record<string, { participants: TimeInterval[] }>,
  rawStart: Date,
  rawEnd: Date,
  windowStart: Date,
  windowEnd: Date,
  bucket: 'conferences' | 'participants',
) {
  const effectiveStart = Math.max(rawStart.getTime(), windowStart.getTime())
  const effectiveEnd = Math.min(rawEnd.getTime(), windowEnd.getTime())

  if (effectiveEnd <= effectiveStart) return

  let dayStart = startOfDay(new Date(effectiveStart))

  while (dayStart.getTime() < effectiveEnd) {
    const nextDay = addDays(dayStart, 1)
    const dayKey = format(dayStart, 'yyyy-MM-dd')
    const clippedStart = Math.max(effectiveStart, dayStart.getTime())
    const clippedEnd = Math.min(effectiveEnd, nextDay.getTime())

    if (dayKey in dayMap && clippedEnd > clippedStart) {
      dayMap[dayKey][bucket].push({ start: clippedStart, end: clippedEnd })
    }

    dayStart = nextDay
  }
}

function peakFromIntervals(intervals: TimeInterval[]): number {
  if (intervals.length === 0) return 0

  const events: { time: number; delta: number }[] = []
  for (const interval of intervals) {
    events.push({ time: interval.start, delta: 1 })
    events.push({ time: interval.end, delta: -1 })
  }

  events.sort((a, b) => a.time - b.time || a.delta - b.delta)

  let current = 0
  let peak = 0
  for (const event of events) {
    current += event.delta
    if (current > peak) peak = current
  }

  return peak
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

function getWindowDays(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed)) return DEFAULT_WINDOW_DAYS
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, parsed))
}
