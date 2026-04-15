'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'

interface LatestQuality {
  overallQuality: number | null
  audioQuality: number | null
  videoQuality: number | null
  presentationQuality: number | null
  rxPacketsLost: number | null
  rxPacketsRecv: number | null
  txPacketsLost: number | null
  txPacketsSent: number | null
  timestamp: string
}

interface RealtimeEvent {
  id: number
  name: string | null
  identity: string | null
  joinTime: string
  leaveTime: string | null
  callUuid: string | null
  protocol: string | null
  role: string | null
  callQuality: string | null
  audioQuality: string | null
  videoQuality: string | null
  rxBandwidth: number | null
  txBandwidth: number | null
  encryption: string | null
  mediaNode: string | null
  latestQuality: LatestQuality | null
  conference: {
    id: number
    vmr: { id: number; name: string }
  }
}

function qualityColor(quality: string | null | undefined): string {
  if (!quality) return 'bg-gray-200 text-gray-600'
  if (quality.includes('good')) return 'bg-green-100 text-green-700'
  if (quality.includes('ok')) return 'bg-yellow-100 text-yellow-700'
  if (quality.includes('bad')) return 'bg-orange-100 text-orange-700'
  if (quality.includes('terrible')) return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function qualityDot(quality: string | null | undefined): string {
  if (!quality) return 'bg-gray-300'
  if (quality.includes('good')) return 'bg-green-500'
  if (quality.includes('ok')) return 'bg-yellow-500'
  if (quality.includes('bad')) return 'bg-orange-500'
  if (quality.includes('terrible')) return 'bg-red-500'
  return 'bg-gray-400'
}

function qualityLabel(quality: string | null | undefined): string {
  if (!quality) return 'N/A'
  if (quality.includes('good')) return 'Good'
  if (quality.includes('ok')) return 'OK'
  if (quality.includes('bad')) return 'Bad'
  if (quality.includes('terrible')) return 'Terrible'
  if (quality.includes('unknown')) return 'Unknown'
  return quality
}

function qualityNumLabel(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'N/A'
  switch (num) {
    case 1: return 'Good'
    case 2: return 'OK'
    case 3: return 'Bad'
    case 4: return 'Terrible'
    default: return 'Unknown'
  }
}

function qualityNumColor(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'text-gray-400'
  switch (num) {
    case 1: return 'text-green-600'
    case 2: return 'text-yellow-600'
    case 3: return 'text-orange-600'
    case 4: return 'text-red-600'
    default: return 'text-gray-500'
  }
}

function packetLossPercent(lost: number | null | undefined, total: number | null | undefined): string {
  if (!lost || !total || total === 0) return '0%'
  return ((lost / total) * 100).toFixed(2) + '%'
}

export default function RealtimePage() {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/realtime')
      const data = await res.json()
      setEvents(data.events ?? [])
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 5000)
    return () => clearInterval(interval)
  }, [])

  // Group events by VMR
  const vmrGroups = events.reduce<Record<string, { vmr: { id: number; name: string }; participants: RealtimeEvent[] }>>((acc, event) => {
    const vmrName = event.conference.vmr.name
    if (!acc[vmrName]) {
      acc[vmrName] = { vmr: event.conference.vmr, participants: [] }
    }
    acc[vmrName].participants.push(event)
    return acc
  }, {})

  // Compute quality stats
  const participantsWithQuality = events.filter(e => e.callQuality)
  const qualityCounts = { good: 0, ok: 0, bad: 0, terrible: 0, unknown: 0 }
  for (const e of participantsWithQuality) {
    const q = e.callQuality ?? ''
    if (q.includes('good')) qualityCounts.good++
    else if (q.includes('ok')) qualityCounts.ok++
    else if (q.includes('bad')) qualityCounts.bad++
    else if (q.includes('terrible')) qualityCounts.terrible++
    else qualityCounts.unknown++
  }

  const totalRxLost = events.reduce((sum, e) => sum + (e.latestQuality?.rxPacketsLost ?? 0), 0)
  const totalRxRecv = events.reduce((sum, e) => sum + (e.latestQuality?.rxPacketsRecv ?? 0), 0)
  const totalTxLost = events.reduce((sum, e) => sum + (e.latestQuality?.txPacketsLost ?? 0), 0)
  const totalTxSent = events.reduce((sum, e) => sum + (e.latestQuality?.txPacketsSent ?? 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Real-time Activity</h1>
          <p className="text-gray-500 mt-1">Live conferences, participants, and call quality</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-600">Live</span>
          {lastUpdated && (
            <span className="text-xs text-gray-400 ml-2">Updated {formatRelativeTime(lastUpdated)}</span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active VMRs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{Object.keys(vmrGroups).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Participants</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{events.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg per VMR</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {Object.keys(vmrGroups).length > 0
              ? (events.length / Object.keys(vmrGroups).length).toFixed(1)
              : '0'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quality Issues</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            <span className={qualityCounts.bad + qualityCounts.terrible > 0 ? 'text-red-600' : 'text-green-600'}>
              {qualityCounts.bad + qualityCounts.terrible}
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">bad or terrible</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">RX Packet Loss</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {packetLossPercent(totalRxLost, totalRxLost + totalRxRecv)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">aggregate receive</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">TX Packet Loss</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {packetLossPercent(totalTxLost, totalTxLost + totalTxSent)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">aggregate transmit</p>
        </div>
      </div>

      {/* Quality breakdown bar */}
      {participantsWithQuality.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Call Quality Distribution</h2>
            <span className="text-xs text-gray-400">{participantsWithQuality.length} participant{participantsWithQuality.length !== 1 ? 's' : ''} with quality data</span>
          </div>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
            {qualityCounts.good > 0 && (
              <div className="bg-green-500 transition-all" style={{ width: `${(qualityCounts.good / participantsWithQuality.length) * 100}%` }} title={`Good: ${qualityCounts.good}`} />
            )}
            {qualityCounts.ok > 0 && (
              <div className="bg-yellow-400 transition-all" style={{ width: `${(qualityCounts.ok / participantsWithQuality.length) * 100}%` }} title={`OK: ${qualityCounts.ok}`} />
            )}
            {qualityCounts.bad > 0 && (
              <div className="bg-orange-500 transition-all" style={{ width: `${(qualityCounts.bad / participantsWithQuality.length) * 100}%` }} title={`Bad: ${qualityCounts.bad}`} />
            )}
            {qualityCounts.terrible > 0 && (
              <div className="bg-red-500 transition-all" style={{ width: `${(qualityCounts.terrible / participantsWithQuality.length) * 100}%` }} title={`Terrible: ${qualityCounts.terrible}`} />
            )}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2 h-2 rounded-full bg-green-500" /> Good ({qualityCounts.good})</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2 h-2 rounded-full bg-yellow-400" /> OK ({qualityCounts.ok})</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2 h-2 rounded-full bg-orange-500" /> Bad ({qualityCounts.bad})</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2 h-2 rounded-full bg-red-500" /> Terrible ({qualityCounts.terrible})</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-12 text-center text-gray-500">Loading...</div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-12 text-center text-gray-500">No active conferences</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(vmrGroups).map(([vmrName, group]) => (
            <div key={vmrName} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <Link href={`/vmrs/${group.vmr.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600">
                    {vmrName}
                  </Link>
                </div>
                <span className="text-xs text-gray-500">{group.participants.length} participant{group.participants.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {group.participants.map(event => (
                  <Link
                    key={event.id}
                    href={`/realtime/${event.id}`}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer block"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                      →
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {event.name ?? 'Unknown participant'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Joined {formatRelativeTime(event.joinTime)}
                        {event.protocol && <> · {event.protocol}</>}
                        {event.role && <> · {event.role}</>}
                        {event.encryption && <> · 🔒 {event.encryption}</>}
                      </p>
                    </div>
                    {/* Quality & bandwidth indicators */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {event.callQuality && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${qualityColor(event.callQuality)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(event.callQuality)}`} />
                          {qualityLabel(event.callQuality)}
                        </span>
                      )}
                      {event.latestQuality && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className={qualityNumColor(event.latestQuality.audioQuality)} title="Audio quality">
                            🔊 {qualityNumLabel(event.latestQuality.audioQuality)}
                          </span>
                          <span className={qualityNumColor(event.latestQuality.videoQuality)} title="Video quality">
                            📹 {qualityNumLabel(event.latestQuality.videoQuality)}
                          </span>
                        </div>
                      )}
                      {(event.rxBandwidth != null || event.txBandwidth != null) && (
                        <span className="text-xs text-gray-400" title="RX / TX bandwidth">
                          ↓{event.rxBandwidth ?? '-'} ↑{event.txBandwidth ?? '-'} kbps
                        </span>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

