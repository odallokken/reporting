'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import type { StaticVMR } from '@/lib/types'

const SETTINGS_STORAGE_KEY = 'pexip-basic-import-settings-v1'

interface BrowserCredentialStore {
  get: (options?: unknown) => Promise<{ id?: string; password?: string } | null>
}

function useCredentials() {
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        let savedUsername = ''
        if (raw) {
          const saved = JSON.parse(raw) as { baseUrl?: string; username?: string }
          if (saved.baseUrl) setBaseUrl(saved.baseUrl)
          if (saved.username) {
            savedUsername = saved.username
            setUsername(saved.username)
          }
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
      } catch {
        // ignore
      } finally {
        setLoaded(true)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { baseUrl, username, password, loaded }
}

export default function StaticVMRsPage() {
  const { baseUrl, username, password, loaded } = useCredentials()
  const [vmrs, setVmrs] = useState<StaticVMR[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const missingCredentials = loaded && (!baseUrl || !username || !password)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Static VMRs</h1>
          <p className="text-gray-500 mt-1">
            {missingCredentials
              ? 'Configure credentials in Settings to view static VMRs'
              : `${total} VMRs configured on Management Node`}
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
                placeholder="Search static VMRs..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guests</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                ) : vmrs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No static VMRs found</td></tr>
                ) : (
                  vmrs.map(vmr => (
                    <tr key={vmr.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{vmr.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{vmr.description || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{vmr.service_type || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${vmr.allow_guests ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {vmr.allow_guests ? 'Allowed' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{vmr.tag || '—'}</td>
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
