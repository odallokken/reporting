'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { useCredentials } from '@/lib/credentials'
import type { VMRWithStats } from '@/lib/types'

export default function DynamicVMRsPage() {
  const router = useRouter()
  const { baseUrl, username, password, loaded } = useCredentials()
  const [vmrs, setVmrs] = useState<VMRWithStats[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('lastUsedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(true)
  const limit = 20

  const fetchVmrs = useCallback(async () => {
    if (!loaded) return
    setLoading(true)
    try {
      const res = await fetch('/api/vmrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          limit,
          search,
          sortBy,
          sortOrder,
          baseUrl,
          username,
          password
        })
      })
      const data = await res.json()
      setVmrs(data.vmrs ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, search, sortBy, sortOrder, loaded, baseUrl, username, password])

  useEffect(() => { fetchVmrs() }, [fetchVmrs])

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortOrder('desc') }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return null
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dynamic VMRs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{total} VMRs discovered from conference history</p>
        </div>
        <a
          href="/api/vmrs/export?format=csv"
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 text-sm font-medium transition-all shadow-sm"
        >
          <Download size={16} />
          Export CSV
        </a>
      </div>

      <div className="bg-white dark:bg-surface-dark-card rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700/50">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search VMRs..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-surface-dark-alt rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-surface-dark">
              <tr>
                {[
                  { key: 'name', label: 'Name' },
                  { key: 'lastUsedAt', label: 'Last Used' },
                  { key: 'totalCalls', label: 'Total Calls' },
                  { key: 'totalParticipants', label: 'Participants' },
                  { key: 'status', label: 'Status' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.key !== 'status' && handleSort(col.key)}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.key !== 'status' ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
              ) : vmrs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No VMRs found</td></tr>
              ) : (
                vmrs.map(vmr => (
                  <tr
                    key={vmr.id}
                    onClick={() => router.push(`/vmrs/dynamic/${vmr.id}`)}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${vmr.isStale ? 'bg-yellow-50 dark:bg-yellow-500/5' : ''}`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{vmr.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatRelativeTime(vmr.lastUsedAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vmr.totalCalls}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vmr.totalParticipants}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${vmr.isStale ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'}`}>
                        {vmr.isStale ? 'Stale' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700/50 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors"
              >Previous</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
