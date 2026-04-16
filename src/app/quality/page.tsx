'use client'

import { useState, useEffect } from 'react'
import { QualityDistributionChart } from '@/components/charts/QualityDistributionChart'
import { QualityTrendChart } from '@/components/charts/QualityTrendChart'
import { formatRelativeTime } from '@/lib/utils'
import { ShieldAlert, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import Link from 'next/link'

interface ProblemCall {
  id: number
  name: string | null
  protocol: string | null
  callQuality: string | null
  joinTime: string
  leaveTime: string | null
  duration: number | null
  vmrName: string
  vendor: string | null
  mediaStreams: { streamType: string; rxPacketLoss: number | null; txPacketLoss: number | null }[]
}

interface QualityData {
  qualityDistribution: Record<string, number>
  qualityTrends: { date: string; avgQuality: number | null; sampleCount: number }[]
  problemCalls: ProblemCall[]
  packetLossBuckets: { good: number; warning: number; bad: number }
  totalParticipants: number
}

function packetLossColor(loss: number | null): string {
  if (loss === null) return 'text-gray-400 dark:text-gray-500'
  if (loss < 0.2) return 'text-emerald-600 dark:text-emerald-400'
  if (loss < 2) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function qualityBadge(quality: string | null): { label: string; color: string } {
  if (!quality) return { label: 'Unknown', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' }
  if (quality.includes('good')) return { label: 'Good', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' }
  if (quality.includes('ok')) return { label: 'OK', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' }
  if (quality.includes('bad')) return { label: 'Bad', color: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' }
  if (quality.includes('terrible')) return { label: 'Terrible', color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' }
  return { label: 'Unknown', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' }
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null) return '-'
  const mins = Math.floor(seconds / 60)
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  if (hours > 0) return `${hours}h ${remainMins}m`
  return `${mins}m`
}

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/quality')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch quality data')
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Call Quality</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Loading quality data...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6 h-[380px] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Call Quality</h1>
        <p className="text-red-500">{error ?? 'Failed to load data'}</p>
      </div>
    )
  }

  const qualityDistData = Object.entries(data.qualityDistribution).map(([name, value]) => ({ name, value }))
  const totalPacketLoss = data.packetLossBuckets.good + data.packetLossBuckets.warning + data.packetLossBuckets.bad

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Call Quality</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Call quality metrics and problem call analysis (last 30 days)</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Calls Measured</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.totalParticipants}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Last 30 days</p>
            </div>
            <div className="bg-primary-50 dark:bg-primary-500/10 p-3 rounded-xl">
              <ShieldAlert size={22} className="text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Good Quality</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {data.totalParticipants > 0 ? Math.round((data.qualityDistribution.good / data.totalParticipants) * 100) : 0}%
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{data.qualityDistribution.good} calls</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl">
              <CheckCircle size={22} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Problem Calls</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                {data.qualityDistribution.bad + data.qualityDistribution.terrible}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Bad + Terrible</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
              <XCircle size={22} className="text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">High Packet Loss</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {totalPacketLoss > 0 ? Math.round(((data.packetLossBuckets.warning + data.packetLossBuckets.bad) / totalPacketLoss) * 100) : 0}%
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Streams &gt; 0.2% loss</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl">
              <AlertTriangle size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quality Distribution</h2>
          <QualityDistributionChart data={qualityDistData} />
        </div>
        <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quality Trend (30 Days)</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Lower is better — 1 = Good, 4 = Terrible</p>
          <QualityTrendChart data={data.qualityTrends} />
        </div>
      </div>

      {/* Packet Loss Breakdown */}
      <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Packet Loss Overview</h2>
        <div className="flex gap-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-emerald-500" />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">&lt; 0.2% loss</span>
              <span className="text-sm text-gray-400 dark:text-gray-500 ml-2">{data.packetLossBuckets.good} streams</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">0.2% – 2% loss</span>
              <span className="text-sm text-gray-400 dark:text-gray-500 ml-2">{data.packetLossBuckets.warning} streams</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">≥ 2% loss</span>
              <span className="text-sm text-gray-400 dark:text-gray-500 ml-2">{data.packetLossBuckets.bad} streams</span>
            </div>
          </div>
        </div>
        {totalPacketLoss > 0 && (
          <div className="mt-4 h-4 flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
            <div className="bg-emerald-500 transition-all" style={{ width: `${(data.packetLossBuckets.good / totalPacketLoss) * 100}%` }} />
            <div className="bg-amber-500 transition-all" style={{ width: `${(data.packetLossBuckets.warning / totalPacketLoss) * 100}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${(data.packetLossBuckets.bad / totalPacketLoss) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Problem calls table */}
      <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Problem Calls</h2>
        {data.problemCalls.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No problem calls found in the last 30 days</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Participant</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">VMR</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Quality</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Protocol</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Duration</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Rx Loss</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Tx Loss</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">When</th>
                </tr>
              </thead>
              <tbody>
                {data.problemCalls.map((call) => {
                  const badge = qualityBadge(call.callQuality)
                  const videoStream = call.mediaStreams.find((ms) => ms.streamType === 'video')
                  return (
                    <tr key={call.id} className="border-b border-gray-100 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3">
                        <Link href={`/realtime/${call.id}`} className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
                          {call.name ?? 'Unknown'}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{call.vmrName}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{call.protocol ?? '-'}</td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{formatDurationSeconds(call.duration)}</td>
                      <td className={`py-3 px-3 font-mono ${packetLossColor(videoStream?.rxPacketLoss ?? null)}`}>
                        {videoStream?.rxPacketLoss != null ? `${videoStream.rxPacketLoss.toFixed(2)}%` : '-'}
                      </td>
                      <td className={`py-3 px-3 font-mono ${packetLossColor(videoStream?.txPacketLoss ?? null)}`}>
                        {videoStream?.txPacketLoss != null ? `${videoStream.txPacketLoss.toFixed(2)}%` : '-'}
                      </td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400">{formatRelativeTime(call.joinTime)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
