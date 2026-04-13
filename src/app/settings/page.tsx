'use client'
import { useState } from 'react'
import { Copy, CheckCircle } from 'lucide-react'

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported?: number; skipped?: number; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const eventSinkUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/events`
    : '/api/events'

  const handleImport = async () => {
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/cdrs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, username, password })
      })
      const data = await res.json()
      setImportResult(data)
    } catch {
      setImportResult({ error: 'Network error' })
    } finally {
      setImporting(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(eventSinkUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your Pexip Infinity connection</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Sink URL</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure this URL in Pexip Infinity Management Node under <strong>Platform &gt; Global Settings &gt; Event sink</strong>.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 break-all">
              {eventSinkUrl}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import CDRs from Pexip Management API</h2>
          <p className="text-sm text-gray-600 mb-6">
            Import historical conference data from your Pexip Infinity Management Node.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Management Node URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://pexip.example.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleImport}
              disabled={importing || !baseUrl || !username || !password}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import CDRs'}
            </button>
          </div>

          {importResult && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {importResult.error ? (
                <p>Error: {importResult.error}</p>
              ) : (
                <p>Import complete: {importResult.imported} imported, {importResult.skipped} skipped</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
