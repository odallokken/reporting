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
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
  warn: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [levelFilter, setLevelFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const pageSize = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (levelFilter) params.set('level', levelFilter)
      const res = await fetch(`/api/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
    } catch {
      // Silently fail — the user can retry
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
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-gray-500 mt-1">Application logs and diagnostics</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={e => { setLevelFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
          <button onClick={fetchLogs} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin text-gray-400' : 'text-gray-600'} />
          </button>
          <button onClick={handleClear} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-red-500" title="Clear all logs">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {logs.length === 0 && !loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">No log entries found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map(entry => {
              const config = levelConfig[entry.level] ?? levelConfig.info
              const Icon = config.icon
              const isExpanded = expandedId === entry.id
              return (
                <div
                  key={entry.id}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex-shrink-0 p-1 rounded ${config.bg}`}>
                      <Icon size={14} className={config.color} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{entry.message}</span>
                        {entry.source && (
                          <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{entry.source}</span>
                        )}
                      </div>
                      {isExpanded && entry.details && (
                        <pre className="mt-2 text-xs text-gray-600 bg-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">{entry.details}</pre>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400 mt-0.5">
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
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>{total} total log{total !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
