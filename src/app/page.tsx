'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ActiveStaticVmrCard } from '@/components/ActiveStaticVmrCard'
import { LiveActivityStatsCards } from '@/components/LiveActivityStatsCards'
import { StaticVmrCountCard } from '@/components/StaticVmrCountCard'
import { PeakConcurrencyChart } from '@/components/charts/PeakConcurrencyChart'
import { TopStaticVMRsBarChart } from '@/components/charts/TopStaticVMRsBarChart'
import { formatRelativeTime } from '@/lib/utils'
import type { DashboardStats } from '@/lib/types'

const WINDOW_OPTIONS = [30, 90, 180, 365]
const SUMMARY_SKELETON_CLASS = 'glass-card rounded-2xl shadow-glass p-6 h-32 animate-pulse'
const CHART_SKELETON_CLASS = 'glass-card rounded-2xl shadow-glass p-6 h-[380px] animate-pulse'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState(30)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`/api/dashboard?days=${windowDays}`)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch dashboard data')
        return response.json()
      })
      .then(setData)
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false))
  }, [windowDays])

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Loading dashboard...</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={SUMMARY_SKELETON_CLASS} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className={CHART_SKELETON_CLASS} />
          ))}
        </div>

        <div className={CHART_SKELETON_CLASS} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Dashboard</h1>
        <p className="text-red-500">{error ?? 'Failed to load dashboard data'}</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your Pexip Infinity environment with participant concurrency for the last {data.windowDays} days.</p>
          </div>
          <div>
            <label htmlFor="dashboard-window-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time span</label>
            <select
              id="dashboard-window-days"
              value={windowDays}
              onChange={(event) => setWindowDays(Number.parseInt(event.target.value, 10))}
              className="px-3 py-2 border border-gray-200/60 dark:border-gray-700/40 bg-white/60 dark:bg-surface-dark-card/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Last {option} days
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <LiveActivityStatsCards
          initialActiveConferences={data.activeConferences}
          initialActiveParticipants={data.activeParticipants}
        />
        <StaticVmrCountCard />
        <ActiveStaticVmrCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Peak Concurrent Participants</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Per-day peak based on overlapping participant intervals across the last {data.windowDays} days.</p>
          <PeakConcurrencyChart data={data.peakConcurrency} />
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
              <Link key={event.id} href={`/realtime/${event.id}`} aria-label={`View details for ${event.name ?? 'Unknown'} in ${event.conference.vmr.name}`} className="flex items-center gap-4 py-3 px-3 rounded-lg border-b border-gray-100 dark:border-gray-700/30 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${event.leaveTime || event.conference.endTime ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {event.name ?? 'Unknown'} — {event.conference.vmr.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {event.leaveTime || event.conference.endTime ? 'Left' : 'Joined'} {formatRelativeTime(event.leaveTime || event.conference.endTime || event.joinTime)}
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
