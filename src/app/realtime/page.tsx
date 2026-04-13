'use client'
import { useState, useEffect } from 'react'
import { formatRelativeTime } from '@/lib/utils'

interface RealtimeEvent {
  id: number
  name: string | null
  joinTime: string
  leaveTime: string | null
  callUuid: string | null
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">{events.length} recent events</h2>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.length === 0 ? (
              <p className="px-6 py-12 text-center text-gray-500">No recent events</p>
            ) : (
              events.map(event => (
                <div key={event.id} className="px-6 py-4 flex items-center gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${event.leaveTime ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {event.leaveTime ? '←' : '→'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      <span className={event.leaveTime ? 'text-red-600' : 'text-green-600'}>
                        {event.leaveTime ? 'Left' : 'Joined'}
                      </span>
                      {' '}{event.name ?? 'Unknown participant'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.conference.vmr.name} · {formatRelativeTime(event.joinTime)}
                    </p>
                  </div>
                  {event.callUuid && (
                    <span className="text-xs text-gray-400 font-mono truncate max-w-[160px]">{event.callUuid}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
