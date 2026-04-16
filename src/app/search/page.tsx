'use client'

import { useState, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'

interface SearchResult {
  id: number
  name: string | null
  identity: string | null
  sourceAlias: string | null
  destinationAlias: string | null
  callUuid: string | null
  remoteAddress: string | null
  protocol: string | null
  vendor: string | null
  callDirection: string | null
  encryption: string | null
  callQuality: string | null
  disconnectReason: string | null
  duration: number | null
  joinTime: string
  leaveTime: string | null
  role: string | null
  vmrName: string
  vmrId: number
  conferenceId: number
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function qualityBadge(quality: string | null): { label: string; color: string } {
  if (!quality) return { label: '-', color: 'text-gray-400 dark:text-gray-500' }
  if (quality.includes('good')) return { label: 'Good', color: 'text-emerald-600 dark:text-emerald-400' }
  if (quality.includes('ok')) return { label: 'OK', color: 'text-amber-600 dark:text-amber-400' }
  if (quality.includes('bad')) return { label: 'Bad', color: 'text-orange-600 dark:text-orange-400' }
  if (quality.includes('terrible')) return { label: 'Terrible', color: 'text-red-600 dark:text-red-400' }
  return { label: '-', color: 'text-gray-400 dark:text-gray-500' }
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null) return '-'
  const mins = Math.floor(seconds / 60)
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  if (hours > 0) return `${hours}h ${remainMins}m`
  return `${mins}m`
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const doSearch = useCallback(async (searchQuery: string, searchPage: number) => {
    if (searchQuery.trim().length < 2) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}&page=${searchPage}&limit=25`)
      if (!res.ok) throw new Error('Search failed')
      const result = await res.json()
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    doSearch(query, 1)
  }

  const goToPage = (newPage: number) => {
    setPage(newPage)
    doSearch(query, newPage)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Participant Search</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Search across all conferences by participant name, alias, IP address, or call UUID</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, alias, IP address, call UUID, or vendor..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 bg-white/60 dark:bg-surface-dark-card/60 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-2xl text-sm font-medium transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results */}
      {data && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data.total === 0 ? 'No results found' : `${data.total} result${data.total !== 1 ? 's' : ''} found`}
            </p>
            {data.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-xl border border-gray-200/60 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= data.totalPages}
                  className="p-2 rounded-xl border border-gray-200/60 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            )}
          </div>

          {data.results.length > 0 && (
            <div className="glass-card rounded-2xl shadow-glass overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5">
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Participant</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">VMR</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Protocol</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Direction</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Quality</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Duration</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Remote IP</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Disconnect</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r) => {
                      const qBadge = qualityBadge(r.callQuality)
                      return (
                        <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4">
                            <Link href={`/realtime/${r.id}`} className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
                              {r.name ?? r.sourceAlias ?? 'Unknown'}
                            </Link>
                            {r.identity && <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">{r.identity}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <Link href={`/vmrs/dynamic/${r.vmrId}`} className="text-gray-700 dark:text-gray-300 hover:underline">
                              {r.vmrName}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{r.protocol ?? '-'}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400 capitalize">{r.callDirection ?? '-'}</td>
                          <td className={`py-3 px-4 font-medium ${qBadge.color}`}>{qBadge.label}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{formatDurationSeconds(r.duration)}</td>
                          <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">{r.remoteAddress ?? '-'}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{r.disconnectReason ?? '-'}</td>
                          <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatRelativeTime(r.joinTime)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-16">
          <Search size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Enter a search term to find participants across all conferences</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Minimum 2 characters required</p>
        </div>
      )}
    </div>
  )
}
