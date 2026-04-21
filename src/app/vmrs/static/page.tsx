'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { useCredentials } from '@/lib/credentials'
import type { StaticVMR } from '@/lib/types'

type SortKey = 'name' | 'lastUsedAt' | 'totalConferences' | 'tag'

export default function StaticVMRsPage() {
  const router = useRouter()
  const { baseUrl, username, password, loaded } = useCredentials()
  const [vmrs, setVmrs] = useState<StaticVMR[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('lastUsedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchVmrs = useCallback(async () => {
    if (!baseUrl || !username || !password) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/vmrs/static', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, username, password, search })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to fetch static VMRs')
        setVmrs([])
        setTotal(0)
        return
      }
      setVmrs(data.vmrs ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, username, password, search])

  useEffect(() => {
    if (loaded && baseUrl && username && password) {
      fetchVmrs()
    }
  }, [loaded, baseUrl, username, password, fetchVmrs])

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortOrder(col === 'totalConferences' || col === 'lastUsedAt' ? 'desc' : 'asc') }
  }

  const sortedVmrs = useMemo(() => {
    const sorted = [...vmrs].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'lastUsedAt': {
          if (!a.lastUsedAt && !b.lastUsedAt) return 0
          if (!a.lastUsedAt) return 1
          if (!b.lastUsedAt) return -1
          return dir * (new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime())
        }
        case 'totalConferences':
          return dir * (a.totalConferences - b.totalConferences)
        case 'tag':
          return dir * (a.tag ?? '').localeCompare(b.tag ?? '')
        default:
          return 0
      }
    })
    return sorted
  }, [vmrs, sortBy, sortOrder])

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return null
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  const missingCredentials = loaded && (!baseUrl || !username || !password)

  const columns: { key: SortKey | 'description' | 'allow_guests'; label: string; sortable: boolean }[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'totalConferences', label: 'Total Calls', sortable: true },
    { key: 'lastUsedAt', label: 'Last Used', sortable: true },
    { key: 'allow_guests', label: 'Guests', sortable: false },
    { key: 'tag', label: 'Tag', sortable: true },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Static VMRs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {missingCredentials
              ? 'Configure credentials in Settings to view static VMRs'
              : `${total} VMRs configured on Management Node`}
          </p>
        </div>
      </div>

      {missingCredentials && (
        <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Credentials required</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Go to <a href="/settings" className="underline font-medium">Settings</a> and configure your Management Node URL, username, and password.
            </p>
          </div>
        </div>
      )}

      {!missingCredentials && (
        <div className="glass-card rounded-2xl shadow-glass">
          <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/30">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search static VMRs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-surface-dark-alt rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {error && (
            <div className="px-6 py-4 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-400 border-b border-red-100 dark:border-red-500/20">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-surface-dark">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key as SortKey)}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none' : ''}`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && <SortIcon col={col.key as SortKey} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                {loading ? (
                  <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
                ) : sortedVmrs.length === 0 ? (
                  <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No static VMRs found</td></tr>
                ) : (
                  sortedVmrs.map(vmr => (
                    <tr
                      key={vmr.id}
                      onClick={() => router.push(`/vmrs/static/${encodeURIComponent(vmr.name)}`)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{vmr.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vmr.description || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vmr.totalConferences}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatRelativeTime(vmr.lastUsedAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${vmr.allow_guests ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'}`}>
                          {vmr.allow_guests ? 'Allowed' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vmr.tag || '—'}</td>
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
