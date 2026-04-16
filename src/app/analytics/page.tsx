'use client'

import { useState, useEffect } from 'react'
import { GenericPieChart } from '@/components/charts/GenericPieChart'
import { GenericBarChart } from '@/components/charts/GenericBarChart'
import { PeakConcurrencyChart } from '@/components/charts/PeakConcurrencyChart'

interface AnalyticsData {
  protocolBreakdown: { name: string; value: number }[]
  vendorBreakdown: { name: string; value: number }[]
  topUsers: { name: string; count: number; totalDuration: number }[]
  callDirectionBreakdown: { name: string; value: number }[]
  encryptionBreakdown: { name: string; value: number }[]
  peakConcurrency: { date: string; peakConferences: number; peakParticipants: number }[]
  durationDistribution: { name: string; value: number }[]
  disconnectReasons: { name: string; value: number }[]
}

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const DIRECTION_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#9ca3af']
const ENCRYPTION_COLORS = ['#10b981', '#ef4444', '#9ca3af']

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch analytics data')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Loading analytics...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-card rounded-2xl shadow-glass p-6 h-[380px] animate-pulse" />
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
        <p className="text-gray-500 dark:text-gray-400 mt-1">Participant analytics, capacity planning, and usage breakdown (last 30 days)</p>
      </div>

      {/* Peak Concurrency */}
      <div className="glass-card rounded-2xl shadow-glass p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Peak Concurrent Usage (30 Days)</h2>
        <PeakConcurrencyChart data={data.peakConcurrency} />
      </div>

      {/* Protocol + Vendor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Participants by Protocol</h2>
          <GenericPieChart data={data.protocolBreakdown} />
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Participants by Vendor / Endpoint</h2>
          <GenericPieChart data={data.vendorBreakdown} />
        </div>
      </div>

      {/* Call Direction + Encryption */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Direction</h2>
          <GenericPieChart data={data.callDirectionBreakdown} colors={DIRECTION_COLORS} />
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Encryption Compliance</h2>
          <GenericPieChart data={data.encryptionBreakdown} colors={ENCRYPTION_COLORS} />
        </div>
      </div>

      {/* Conference Duration + Disconnect Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conference Duration Distribution</h2>
          <GenericBarChart data={data.durationDistribution} color="#05c8aa" label="Conferences" />
        </div>
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Disconnect Reasons</h2>
          <GenericBarChart data={data.disconnectReasons} color="#ef4444" label="Participants" />
        </div>
      </div>

      {/* Top Users table */}
      <div className="glass-card rounded-2xl shadow-glass p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Participants</h2>
        {data.topUsers.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No participant data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">#</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Participant</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Joins</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Total Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((user, i) => (
                  <tr key={user.name} className="border-b border-gray-100 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 text-gray-400 dark:text-gray-500">{i + 1}</td>
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-gray-100">{user.name}</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{user.count}</td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{formatSeconds(user.totalDuration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
