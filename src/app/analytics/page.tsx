'use client'

import { useEffect, useState } from 'react'
import { ActivityLineChart } from '@/components/charts/ActivityLineChart'
import { GenericBarChart } from '@/components/charts/GenericBarChart'
import { GenericPieChart } from '@/components/charts/GenericPieChart'
import { PeakConcurrencyChart } from '@/components/charts/PeakConcurrencyChart'
import { CalendarRange, Clock3, Shield, Users, UserSquare2, Lightbulb } from 'lucide-react'

interface BreakdownItem {
  name: string
  value: number
}

interface PeakConcurrencyPoint {
  date: string
  peakConferences: number
  peakParticipants: number
}

interface TopParticipant {
  name: string
  secondaryLabel: string | null
  conferenceCount: number
  sessionCount: number
  totalDuration: number
  averageDuration: number
}

interface Insight {
  title: string
  value: string
  description: string
}

interface AnalyticsData {
  summary: {
    totalConferences: number
    totalParticipantSessions: number
    uniqueParticipants: number
    peakParticipants: number
    peakConferences: number
    averageParticipantsPerConference: number
    averageConferenceDuration: number
    largestConference: number
    encryptedShare: number | null
  }
  insights: Insight[]
  conferenceActivity: { date: string; count: number }[]
  topVmrs: BreakdownItem[]
  protocolBreakdown: BreakdownItem[]
  vendorBreakdown: BreakdownItem[]
  topParticipants: TopParticipant[]
  callDirectionBreakdown: BreakdownItem[]
  encryptionBreakdown: BreakdownItem[]
  peakConcurrency: PeakConcurrencyPoint[]
  durationDistribution: BreakdownItem[]
  disconnectReasons: BreakdownItem[]
}

function formatSeconds(seconds: number): string {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatMetricValue(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = 'teal',
}: {
  title: string
  value: string
  subtitle: string
  icon: typeof Users
  tone?: 'teal' | 'emerald' | 'blue' | 'amber' | 'purple'
}) {
  const tones = {
    teal: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    blue: 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    purple: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400',
  }

  return (
    <div className="glass-card rounded-2xl shadow-glass p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-2xl ${tones[tone]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch analytics data')
        return response.json()
      })
      .then(setData)
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Loading analytics...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="glass-card rounded-2xl shadow-glass p-6 h-[132px] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="glass-card rounded-2xl shadow-glass p-6 h-[380px] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Analytics</h1>
        <p className="text-red-500">{error ?? 'Failed to load data'}</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Reworked participant and conference analytics using the stored Pexip history data from the last 30 days.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
        <MetricCard
          title="Conferences"
          value={formatMetricValue(data.summary.totalConferences)}
          subtitle="Started in the last 30 days"
          icon={CalendarRange}
          tone="teal"
        />
        <MetricCard
          title="Participant Sessions"
          value={formatMetricValue(data.summary.totalParticipantSessions)}
          subtitle="Recorded participant legs"
          icon={Users}
          tone="blue"
        />
        <MetricCard
          title="Unique Participants"
          value={formatMetricValue(data.summary.uniqueParticipants)}
          subtitle="Grouped by best available identity"
          icon={UserSquare2}
          tone="purple"
        />
        <MetricCard
          title="Peak Concurrent Participants"
          value={formatMetricValue(data.summary.peakParticipants)}
          subtitle={`Peak of ${formatMetricValue(data.summary.peakConferences)} conferences at once`}
          icon={Users}
          tone="emerald"
        />
        <MetricCard
          title="Encryption Coverage"
          value={data.summary.encryptedShare === null ? '—' : `${data.summary.encryptedShare}%`}
          subtitle={data.summary.encryptedShare === null ? 'No reported encryption state' : 'Participant legs with a reported state'}
          icon={Shield}
          tone="amber"
        />
      </div>

      {data.insights.length > 0 && (
        <div className="glass-card rounded-2xl shadow-glass p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
              <Lightbulb size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">What the data suggests</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Actionable signals based on the fields currently stored from Pexip history.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.insights.map((insight) => (
              <div key={insight.title} className="rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-white/40 dark:bg-white/5 p-5">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{insight.title}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{insight.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-6">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Peak Concurrent Usage</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Per-day peak based on overlapping conference and participant intervals, not only their start times.</p>
          <PeakConcurrencyChart data={data.peakConcurrency} />
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Conference Activity</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">How many conferences started each day.</p>
          <ActivityLineChart data={data.conferenceActivity} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Top VMRs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Rooms with the most conferences started in the last 30 days.</p>
          <GenericBarChart data={data.topVmrs} color="#3b8eff" label="Conferences" />
        </div>

        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Top Participants</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ranked by distinct conferences attended, then by total connected time.</p>
          {data.topParticipants.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No participant data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Participant</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Conferences</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Sessions</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Total Time</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Avg Session</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topParticipants.map((participant, index) => (
                    <tr key={`${participant.name}-${index}`} className="border-b border-gray-100 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 text-gray-400 dark:text-gray-500">{index + 1}</td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{participant.name}</p>
                        {participant.secondaryLabel && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{participant.secondaryLabel}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{participant.conferenceCount}</td>
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{participant.sessionCount}</td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{formatSeconds(participant.totalDuration)}</td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{formatSeconds(participant.averageDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Participants by Protocol</h2>
          <GenericPieChart data={data.protocolBreakdown} />
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Participants by Vendor / Endpoint</h2>
          <GenericPieChart data={data.vendorBreakdown} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Direction</h2>
          <GenericPieChart data={data.callDirectionBreakdown} colors={['#3b82f6', '#10b981', '#f59e0b', '#9ca3af']} />
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Encryption Compliance</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Based on the participant encryption state stored in history.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.encryptedShare === null ? '—' : `${data.summary.encryptedShare}%`}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">encrypted</p>
            </div>
          </div>
          <GenericPieChart data={data.encryptionBreakdown} colors={['#10b981', '#ef4444', '#9ca3af']} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6 xl:col-span-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Conference Duration</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Average duration {formatSeconds(data.summary.averageConferenceDuration)}</p>
            </div>
            <div className="p-3 rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
              <Clock3 size={20} />
            </div>
          </div>
          <div className="mt-4">
            <GenericBarChart data={data.durationDistribution} color="#05c8aa" label="Conferences" />
          </div>
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Disconnect Reasons</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Top reasons reported when participant legs ended.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMetricValue(data.summary.largestConference)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">largest conference size</p>
            </div>
          </div>
          <GenericBarChart data={data.disconnectReasons} color="#ef4444" label="Participants" />
        </div>
      </div>
    </div>
  )
}
