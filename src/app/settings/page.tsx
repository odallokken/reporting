'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Copy, CheckCircle, Trash2, UserPlus } from 'lucide-react'

const SETTINGS_STORAGE_KEY = 'pexip-basic-import-settings-v1'
type BrowserCredentialStore = {
  get: (options?: unknown) => Promise<{ id?: string; password?: string } | null>
}
type BrowserPasswordCredentialConstructor = new (data: { id: string; password: string; name?: string }) => Credential

interface AppUser {
  id: number
  username: string
  role: string
  createdAt: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported?: number; skipped?: number; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saved-partial' | 'error' | null>(null)
  const [excludeShortConferences, setExcludeShortConferences] = useState(false)
  const [minDurationSeconds, setMinDurationSeconds] = useState('30')

  // User management state
  const [users, setUsers] = useState<AppUser[]>([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('admin')
  const [userError, setUserError] = useState('')
  const [userLoading, setUserLoading] = useState(false)
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  const eventSinkUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/events`
    : '/api/events'

  const hasImportFields = Boolean(username && password)
  const saveStatusStyles: Record<'saved' | 'saved-partial' | 'error', string> = {
    saved: 'bg-green-50 text-green-700',
    'saved-partial': 'bg-yellow-50 text-yellow-800',
    error: 'bg-red-50 text-red-700'
  }

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        let savedUsername = ''
        if (raw) {
          const saved = JSON.parse(raw) as { baseUrl?: string; username?: string; excludeShortConferences?: boolean; minDurationSeconds?: string }
          if (saved.baseUrl) setBaseUrl(saved.baseUrl)
          if (saved.username) {
            savedUsername = saved.username
            setUsername(saved.username)
          }
          if (saved.excludeShortConferences !== undefined) setExcludeShortConferences(saved.excludeShortConferences)
          if (saved.minDurationSeconds) setMinDurationSeconds(saved.minDurationSeconds)
        }

        const savedPassword = window.sessionStorage.getItem(`${SETTINGS_STORAGE_KEY}-pw`)
        if (savedPassword) setPassword(savedPassword)

        if ('credentials' in navigator) {
          const credential = await (navigator.credentials as BrowserCredentialStore).get({
            password: true,
            mediation: 'optional'
          })
          if (credential?.id && !savedUsername) setUsername(credential.id)
          if (credential?.password) setPassword(credential.password)
        }
      } catch (error) {
        console.warn('Could not load saved credentials:', error)
      }
    }

    loadSaved()
  }, [])

  // Fetch users
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users')
      if (res.ok) {
        const data = await res.json() as { users: AppUser[] }
        setUsers(data.users)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserError('')
    setUserLoading(true)

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      })
      const data = await res.json() as { error?: string }

      if (!res.ok) {
        setUserError(data.error ?? 'Failed to create user')
        return
      }

      setNewUsername('')
      setNewPassword('')
      setNewRole('admin')
      setShowAddUser(false)
      fetchUsers()
    } catch {
      setUserError('An error occurred')
    } finally {
      setUserLoading(false)
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const res = await fetch(`/api/auth/users?id=${id}`, { method: 'DELETE' })
      const data = await res.json() as { error?: string }

      if (!res.ok) {
        alert(data.error ?? 'Failed to delete user')
        return
      }

      fetchUsers()
    } catch {
      alert('An error occurred')
    }
  }

  const handleSave = async () => {
    try {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ baseUrl, username, excludeShortConferences, minDurationSeconds })
      )
      window.sessionStorage.setItem(`${SETTINGS_STORAGE_KEY}-pw`, password)

      const PasswordCredentialCtor = (window as { PasswordCredential?: BrowserPasswordCredentialConstructor }).PasswordCredential
      if ('credentials' in navigator && PasswordCredentialCtor && password) {
        const credential = new PasswordCredentialCtor({
          id: username,
          password,
          name: 'Pexip Management API'
        })
        await navigator.credentials.store(credential)
        setSaveStatus('saved')
      } else {
        setSaveStatus('saved-partial')
      }
    } catch (error) {
      console.warn('Could not save credentials:', error)
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
          username,
          password,
          minDurationSeconds: excludeShortConferences ? parseInt(minDurationSeconds, 10) || 0 : 0
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
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
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeShortConferences}
                  onChange={e => setExcludeShortConferences(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Exclude short conferences</span>
              </label>
              {excludeShortConferences && (
                <div className="mt-2 ml-6">
                  <label className="block text-sm text-gray-600 mb-1">Minimum duration (seconds)</label>
                  <input
                    type="number"
                    min="1"
                    value={minDurationSeconds}
                    onChange={e => setMinDurationSeconds(e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Conferences shorter than this will be excluded (e.g. to filter SIP scanner calls).
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleSave}
                disabled={!baseUrl || !username}
                className="w-full py-2 px-4 border border-gray-300 text-gray-800 rounded-lg font-medium text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save credentials
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !baseUrl || !hasImportFields}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import CDRs'}
              </button>
            </div>
          </div>

          {saveStatus && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${saveStatusStyles[saveStatus]}`}>
              {saveStatus === 'saved' && 'Saved URL/username and password in your browser credential store.'}
              {saveStatus === 'saved-partial' && 'Saved URL/username. Browser secure password storage is not available here.'}
              {saveStatus === 'error' && 'Could not save settings in this browser.'}
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

        {isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <UserPlus size={16} />
                Add User
              </button>
            </div>

            {showAddUser && (
              <form onSubmit={handleAddUser} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
                {userError && (
                  <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{userError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={userLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {userLoading ? 'Creating…' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddUser(false); setUserError('') }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="pb-2 font-medium text-gray-600">Username</th>
                    <th className="pb-2 font-medium text-gray-600">Role</th>
                    <th className="pb-2 font-medium text-gray-600">Created</th>
                    <th className="pb-2 font-medium text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 text-gray-900">
                        {user.username}
                        {String(user.id) === session?.user?.id && (
                          <span className="ml-2 text-xs text-blue-600 font-medium">(you)</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        {String(user.id) !== session?.user?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
