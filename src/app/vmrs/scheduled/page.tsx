'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, AlertCircle, ChevronUp, ChevronDown, Calendar } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { useCredentials } from '@/lib/credentials'

interface ScheduledConference {
  id: number
  name: string
  description: string
  creation_time: string | null
  duration: number | null
  start_time: string | null
  end_time: string | null
  is_active: boolean
  service_type: string | null
  tag: string | null
  aliases: string[]
}

type SortKey = 'name' | 'start_time' | 'end_time' | 'duration'

function formatDurationMinutes(minutes: number | null): string {
  if (minutes == null) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default function ScheduledVMRsPage() {
  const { baseUrl, username, password, loaded } = useCredentials()
  const [conferences, setConferences] = useState<ScheduledConference[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('start_time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchConferences = useCallback(async () => {
    if (!baseUrl || !username || !password) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/vmrs/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, username, password, search })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to fetch scheduled conferences')
        setConferences([])
        setTotal(0)
        return
      }
      setConferences(data.conferences ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, username, password, search])

  useEffect(() => {
    if (loaded && baseUrl && username && password) {
      fetchConferences()
    }
  }, [loaded, baseUrl, username, password, fetchConferences])

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortOrder(col === 'start_time' || col === 'end_time' ? 'desc' : 'asc') }
  }

  const sortedConferences = useMemo(() => {
    const sorted = [...conferences].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'start_time': {
          if (!a.start_time && !b.start_time) return 0
          if (!a.start_time) return 1
          if (!b.start_time) return -1
          return dir * (new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        }
        case 'end_time': {
          if (!a.end_time && !b.end_time) return 0
          if (!a.end_time) return 1
          if (!b.end_time) return -1
          return dir * (new Date(a.end_time).getTime() - new Date(b.end_time).getTime())
        }
        case 'duration':
          return dir * ((a.duration ?? 0) - (b.duration ?? 0))
        default:
          return 0
      }
    })
    return sorted
  }, [conferences, sortBy, sortOrder])

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return null
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  const missingCredentials = loaded && (!baseUrl || !username || !password)

  const columns: { key: SortKey | 'aliases' | 'status'; label: string; sortable: boolean }[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'aliases', label: 'Aliases', sortable: false },
    { key: 'start_time', label: 'Start Time', sortable: true },
    { key: 'end_time', label: 'End Time', sortable: true },
    { key: 'duration', label: 'Duration', sortable: true },
    { key: 'status', label: 'Status', sortable: false },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Calendar size={24} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Scheduled VMR Calls</h1>
          </div>
          <p className="text-gray-500 mt-1">
            {missingCredentials
              ? 'Configure credentials in Settings to view scheduled conferences'
              : `${total} scheduled conferences via Outlook`}
          </p>
        </div>
      </div>

      {missingCredentials && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Credentials required</p>
            <p className="text-sm text-yellow-700 mt-1">
              Go to <a href="/settings" className="underline font-medium">Settings</a> and configure your Management Node URL, username, and password.
            </p>
          </div>
        </div>
      )}

      {!missingCredentials && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search scheduled conferences..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="px-6 py-4 bg-red-50 text-sm text-red-700 border-b border-red-100">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key as SortKey)}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && <SortIcon col={col.key as SortKey} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                ) : sortedConferences.length === 0 ? (
                  <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">No scheduled conferences found</td></tr>
                ) : (
                  sortedConferences.map(conf => (
                    <tr key={conf.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{conf.name}</div>
                        {conf.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{conf.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {conf.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {conf.aliases.map((alias, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                {alias}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(conf.start_time)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(conf.end_time)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDurationMinutes(conf.duration)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${conf.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {conf.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
