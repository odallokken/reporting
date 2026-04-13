'use client'
import { useEffect, useMemo, useState } from 'react'
import { Copy, CheckCircle } from 'lucide-react'

type AuthType = 'basic' | 'oauth2'
const SETTINGS_STORAGE_KEY = 'pexip-import-settings-v1'

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState('')
  const [authType, setAuthType] = useState<AuthType>('basic')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [clientId, setClientId] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported?: number; skipped?: number; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error' | null>(null)

  const eventSinkUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/events`
    : '/api/events'

  const hasCredentials = useMemo(() => {
    return authType === 'oauth2'
      ? Boolean(clientId && privateKey)
      : Boolean(username && password)
  }, [authType, clientId, password, privateKey, username])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as {
        baseUrl?: string
        authType?: AuthType
        username?: string
        password?: string
        clientId?: string
        privateKey?: string
      }
      if (saved.baseUrl) setBaseUrl(saved.baseUrl)
      if (saved.authType) setAuthType(saved.authType)
      if (saved.username) setUsername(saved.username)
      if (saved.password) setPassword(saved.password)
      if (saved.clientId) setClientId(saved.clientId)
      if (saved.privateKey) setPrivateKey(saved.privateKey)
    } catch {
      // ignore invalid stored value
    }
  }, [])

  const handleSave = () => {
    try {
      const toSave = { baseUrl, authType, username, password, clientId, privateKey }
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toSave))
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setSaveStatus(null)
    setImportResult(null)
    try {
      const res = await fetch('/api/cdrs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          authType,
          username: authType === 'basic' ? username : undefined,
          password: authType === 'basic' ? password : undefined,
          clientId: authType === 'oauth2' ? clientId : undefined,
          privateKey: authType === 'oauth2' ? privateKey : undefined
        })
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Authentication method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthType('basic')}
                  className={`px-3 py-2 rounded-lg border text-sm ${authType === 'basic' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  Basic (username/password)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType('oauth2')}
                  className={`px-3 py-2 rounded-lg border text-sm ${authType === 'oauth2' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  OAuth2 (client credentials)
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Management Node URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://pexip.example.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the Management Node URL only, for example <span className="font-mono">https://pexip.example.com</span>, without <span className="font-mono">/admin</span> or any other path.
              </p>
            </div>
            {authType === 'basic' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OAuth2 Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    placeholder="your-client-id"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OAuth2 Private Key (PEM)</label>
                  <textarea
                    value={privateKey}
                    onChange={e => setPrivateKey(e.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Create OAuth2 clients in Pexip under <strong>Users &amp; Devices &gt; OAuth2 Clients</strong>, then use their Client ID and Private Key.
                </p>
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleSave}
                disabled={!baseUrl || !hasCredentials}
                className="w-full py-2 px-4 border border-gray-300 text-gray-800 rounded-lg font-medium text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save credentials
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !baseUrl || !hasCredentials}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import CDRs'}
              </button>
            </div>
          </div>

          {saveStatus && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${saveStatus === 'saved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {saveStatus === 'saved'
                ? 'Saved locally in this browser.'
                : 'Could not save settings in this browser.'}
            </div>
          )}

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
