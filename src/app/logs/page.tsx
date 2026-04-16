'use client'
import { useEffect, useState, useCallback } from 'react'
import { Trash2, RefreshCw, AlertCircle, AlertTriangle, Info } from 'lucide-react'

interface LogEntry {
  id: number
  level: string
  message: string
  details: string | null
  source: string | null
  createdAt: string
}

const levelConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  warn: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
  error: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [levelFilter, setLevelFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const pageSize = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (levelFilter) params.set('level', levelFilter)
      const res = await fetch(`/api/logs?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }, [page, levelFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleClear = async () => {
    if (!confirm('Clear all logs?')) return
    await fetch('/api/logs', { method: 'DELETE' })
    setPage(1)
    fetchLogs()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Application logs and diagnostics</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={e => { setLevelFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200/60 dark:border-gray-700/40 bg-white/60 dark:bg-surface-dark-card/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
          <button onClick={fetchLogs} className="p-2 border border-gray-200/60 dark:border-gray-700/40 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin text-gray-400' : 'text-gray-600 dark:text-gray-400'} />
          </button>
          <button onClick={handleClear} className="p-2 border border-gray-200/60 dark:border-gray-700/40 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-red-500 dark:text-red-400 transition-colors" title="Clear all logs">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl shadow-glass overflow-hidden">
        {fetchError ? (
          <div className="p-12 text-center text-red-500 dark:text-red-400 text-sm">Failed to load logs: {fetchError}</div>
        ) : logs.length === 0 && !loading ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-sm">No log entries found</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
            {logs.map(entry => {
              const config = levelConfig[entry.level] ?? levelConfig.info
              const Icon = config.icon
              const isExpanded = expandedId === entry.id
              return (
                <div
                  key={entry.id}
                  className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50 dark:bg-white/5' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex-shrink-0 p-1 rounded ${config.bg}`}>
                      <Icon size={14} className={config.color} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{entry.message}</span>
                        {entry.source && (
                          <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">{entry.source}</span>
                        )}
                      </div>
                      {isExpanded && entry.details && (
                        <pre className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-surface-dark rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">{entry.details}</pre>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{total} total log{total !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-200/60 dark:border-gray-700/40 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-200/60 dark:border-gray-700/40 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
