'use client'
import { useState, useEffect } from 'react'
import { Video } from 'lucide-react'
import { StatsCard } from './StatsCard'

const SETTINGS_STORAGE_KEY = 'pexip-basic-import-settings-v1'

interface BrowserCredentialStore {
  get: (options?: unknown) => Promise<{ id?: string; password?: string } | null>
}

export function StaticVmrCountCard() {
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
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

        if (!baseUrl || !username || !password) return

        const res = await fetch('/api/vmrs/static', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl, username, password, countOnly: true })
        })
        if (!res.ok) return
        const data = await res.json()
        setTotal(data.total ?? null)
      } catch {
        // ignore — card will show fallback
      }
    }
    fetchCount()
  }, [])

  return (
    <StatsCard
      title="Static VMRs"
      value={total ?? '—'}
      subtitle={total !== null ? 'On Management Node' : 'Configure credentials'}
      icon={Video}
      color="purple"
      href="/vmrs/static"
    />
  )
}
