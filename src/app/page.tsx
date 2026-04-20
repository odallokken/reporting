export const dynamic = 'force-dynamic'

import { StatsCard } from '@/components/StatsCard'
import { StaticVmrCountCard } from '@/components/StaticVmrCountCard'
import { ActivityLineChart } from '@/components/charts/ActivityLineChart'
import { TopStaticVMRsBarChart } from '@/components/charts/TopStaticVMRsBarChart'
import { Activity, Users, Wifi } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { DashboardStats } from '@/lib/types'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { format, subDays } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

async function getDashboardData(): Promise<DashboardStats> {
  try {
    const thirtyDaysAgo = subDays(new Date(), 30)
    const excludedIds = await getShortConferenceIds()
    const excludeFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    const [activeVmrs, activeConferences, activeParticipants, recentActivity, recentConferences] = await Promise.all([
      prisma.vMR.count({ where: { lastUsedAt: { gte: thirtyDaysAgo } } }),
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

    return {
      activeVmrs,
      activeConferences,
      activeParticipants,
      recentActivity: recentActivity.map(p => ({
        id: p.id,
        name: p.name,
        joinTime: p.joinTime.toISOString(),
        leaveTime: p.leaveTime?.toISOString() ?? null,
        conference: {
          id: p.conference.id,
          vmr: { id: p.conference.vmr.id, name: p.conference.vmr.name },
        },
      })),
      usageByDay,
      topVmrs: []
    }
  } catch {
    return {
      activeVmrs: 0,
      activeConferences: 0, activeParticipants: 0,
      recentActivity: [], usageByDay: [], topVmrs: []
    }
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your Pexip Infinity environment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Active Conferences" value={data.activeConferences} subtitle="Right now" icon={Wifi} color="green" href="/realtime" />
        <StatsCard title="Active Participants" value={data.activeParticipants} subtitle="Right now" icon={Users} color="teal" href="/realtime" />
        <StaticVmrCountCard />
        <StatsCard title="Active VMRs" value={data.activeVmrs} subtitle="Used in last 30 days" icon={Activity} color="green" href="/vmrs/static" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conference Activity (Last 30 Days)</h2>
          <ActivityLineChart data={data.usageByDay} />
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Most Active VMRs</h2>
          <TopStaticVMRsBarChart />
        </div>
      </div>

      <div className="glass-card rounded-2xl shadow-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          <Link href="/logs" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:underline font-medium">
            View all →
          </Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activity</p>
        ) : (
          <div className="space-y-1">
            {data.recentActivity.map((event) => (
              <Link key={event.id} href={`/realtime/${event.id}`} className="flex items-center gap-4 py-3 px-3 rounded-lg border-b border-gray-100 dark:border-gray-700/30 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${event.leaveTime ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {event.name ?? 'Unknown'} — {event.conference.vmr.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {event.leaveTime ? 'Left' : 'Joined'} {formatRelativeTime(event.joinTime)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
