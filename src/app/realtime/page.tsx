'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'

interface RealtimeEvent {
  id: number
  name: string | null
  identity: string | null
  joinTime: string
  leaveTime: string | null
  callUuid: string | null
  protocol: string | null
  role: string | null
  conference: {
    id: number
    vmr: { id: number; name: string }
  }
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Real-time Activity</h1>
          <p className="text-gray-500 mt-1">Auto-refreshes every 5 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-600">Live</span>
          {lastUpdated && (
            <span className="text-xs text-gray-400 ml-2">Updated {formatRelativeTime(lastUpdated)}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
      </div>

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
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

