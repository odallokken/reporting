export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

const DEFAULT_WINDOW_DAYS = 30
const MAX_WINDOW_DAYS = 365

type PeakConcurrencyPoint = { date: string; peakParticipants: number }
type TimeInterval = { start: number; end: number }

export async function GET(request: Request) {
  try {
    const windowDays = getWindowDays(new URL(request.url).searchParams.get('days'))
    const now = new Date()
    const windowStart = startOfDay(subDays(now, windowDays - 1))
    const windowEnd = addDays(startOfDay(now), 1)
    const excludedIds = await getShortConferenceIds()
    const excludeFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    const [activeVmrs, activeConferences, activeParticipants, recentActivity, participantIntervals] = await Promise.all([
      prisma.vMR.count({ where: { lastUsedAt: { gte: windowStart } } }),
      prisma.vMR.count({
        where: {
          conferences: {
            some: {
              endTime: null,
              participants: { some: { leaveTime: null } },
              ...excludeFilter
            }
          }
        }
      }),
      prisma.participant.count({ where: { leaveTime: null, conference: { endTime: null, ...excludeFilter } } }),
      prisma.participant.findMany({
        take: 10,
        orderBy: { joinTime: 'desc' },
        where: { conference: excludeFilter },
        include: { conference: { include: { vmr: true } } }
      }),
      prisma.participant.findMany({
        where: {
          joinTime: { lt: windowEnd },
          OR: [{ leaveTime: null }, { leaveTime: { gte: windowStart } }],
          conference: excludeFilter,
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
      })
    ])

    const peakConcurrency = calculatePeakConcurrency(
      participantIntervals.map(({ conference, ...participant }) => ({
        ...participant,
        conferenceEndTime: conference.endTime,
      })),
      windowStart,
      windowEnd,
      windowDays,
    )

    return NextResponse.json({
      windowDays,
      activeVmrs,
      activeConferences,
      activeParticipants,
      recentActivity: recentActivity.map((participant) => ({
        id: participant.id,
        name: participant.name,
        joinTime: participant.joinTime.toISOString(),
        leaveTime: participant.leaveTime?.toISOString() ?? null,
        conference: {
          id: participant.conference.id,
          endTime: participant.conference.endTime?.toISOString() ?? null,
          vmr: {
            id: participant.conference.vmr.id,
            name: participant.conference.vmr.name,
          },
        },
      })),
      peakConcurrency,
      topVmrs: []
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
      dayMap[dayKey].participants.push({ start: clippedStart, end: clippedEnd })
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

  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    if (a.delta === b.delta) return 0
    return a.delta - b.delta
  })

  let current = 0
  let peak = 0
  for (const event of events) {
    current += event.delta
    if (current > peak) peak = current
  }

  return peak
}

function effectiveParticipantEndTime(
  participant: { leaveTime: Date | null; conferenceEndTime: Date | null },
  fallbackEndTime: Date,
): Date {
  return participant.leaveTime ?? participant.conferenceEndTime ?? fallbackEndTime
}

function getWindowDays(value: string | null): number {
  const parsedDays = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsedDays)) return DEFAULT_WINDOW_DAYS
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, parsedDays))
}
