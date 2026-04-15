import { StatsCard } from '@/components/StatsCard'
import { ActivityLineChart } from '@/components/charts/ActivityLineChart'
import { TopVMRsBarChart } from '@/components/charts/TopVMRsBarChart'
import { Video, Activity, Users, BarChart2, Wifi } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { DashboardStats } from '@/lib/types'
import Link from 'next/link'

async function getDashboardData(): Promise<DashboardStats> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  } catch {
    return {
      totalVmrs: 0, activeVmrs: 0, staleVmrs: 0,
      totalConferences: 0, totalParticipants: 0,
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your Pexip Infinity environment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatsCard title="Active Conferences" value={data.activeConferences} subtitle="Right now" icon={Wifi} color="green" href="/realtime" />
        <StatsCard title="Active Participants" value={data.activeParticipants} subtitle="Right now" icon={Users} color="blue" href="/realtime" />
        <StatsCard title="Total VMRs" value={data.totalVmrs} icon={Video} color="purple" href="/vmrs/static" />
        <StatsCard title="Total Conferences" value={data.totalConferences} subtitle="All time" icon={BarChart2} color="yellow" href="/logs" />
        <StatsCard title="Active VMRs" value={data.activeVmrs} subtitle="Used in last 30 days" icon={Activity} color="green" href="/vmrs/static" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Conference Activity (Last 30 Days)</h2>
          <ActivityLineChart data={data.usageByDay} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Most Active VMRs</h2>
          <TopVMRsBarChart data={data.topVmrs} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Link href="/logs" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            View all →
          </Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {data.recentActivity.map((event) => (
              <div key={event.id} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${event.leaveTime ? 'bg-red-400' : 'bg-green-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {event.name ?? 'Unknown'} — {event.conference.vmr.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {event.leaveTime ? 'Left' : 'Joined'} {formatRelativeTime(event.joinTime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
