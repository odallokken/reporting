'use client'
import { useState, useEffect } from 'react'
import { TopVMRsBarChart } from './TopVMRsBarChart'

const SETTINGS_STORAGE_KEY = 'pexip-basic-import-settings-v1'

interface BrowserCredentialStore {
  get: (options?: unknown) => Promise<{ id?: string; password?: string } | null>
}

export function TopStaticVMRsBarChart() {
  const [data, setData] = useState<{ name: string; count: number }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTopVmrs = async () => {
      try {
        let baseUrl = ''
        let username = ''
        let password = ''

        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw) as { baseUrl?: string; username?: string }
          baseUrl = saved.baseUrl ?? ''
          username = saved.username ?? ''
        }

        const savedPassword = window.sessionStorage.getItem(`${SETTINGS_STORAGE_KEY}-pw`)
        if (savedPassword) password = savedPassword

        if ('credentials' in navigator) {
          const credential = await (navigator.credentials as BrowserCredentialStore).get({
            password: true,
            mediation: 'optional'
          })
          if (credential?.id && !username) username = credential.id
          if (credential?.password) password = credential.password
        }

        if (!baseUrl || !username || !password) {
          setError('Configure credentials in Settings')
          return
        }

        const res = await fetch('/api/vmrs/static', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl, username, password })
        })
        if (!res.ok) {
          setError('Failed to load static VMRs')
          return
        }
        const result = await res.json() as {
          vmrs: { name: string; totalConferences: number }[]
        }

        const sorted = (result.vmrs ?? [])
          .filter(v => v.totalConferences > 0)
          .sort((a, b) => b.totalConferences - a.totalConferences)
          .slice(0, 5)
          .map(v => ({ name: v.name, count: v.totalConferences }))

        setData(sorted)
      } catch {
        setError('Failed to load static VMR data')
      }
    }
    fetchTopVmrs()
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
        {error}
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
        No conference data for static VMRs
      </div>
    )
  }

  return <TopVMRsBarChart data={data} />
}
