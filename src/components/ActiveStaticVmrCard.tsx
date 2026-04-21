'use client'

import { useEffect, useState } from 'react'
import { subDays } from 'date-fns'
import { Activity } from 'lucide-react'
import { StatsCard } from './StatsCard'
import { useCredentials } from '@/lib/credentials'

interface StaticVmrSummary {
  lastUsedAt: string | null
}

const ACTIVE_WINDOW_DAYS = 30

export function ActiveStaticVmrCard() {
  const { baseUrl, username, password, loaded } = useCredentials()
  const [activeCount, setActiveCount] = useState<number | null>(null)

  useEffect(() => {
    const fetchActiveVmrs = async () => {
      if (!loaded || !baseUrl || !username || !password) return

      try {
        const response = await fetch('/api/vmrs/static', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl, username, password }),
        })

        if (!response.ok) return

        const data = await response.json() as { vmrs?: StaticVmrSummary[] }
        const activeSince = subDays(new Date(), ACTIVE_WINDOW_DAYS)
        const total = (data.vmrs ?? []).filter((vmr) => vmr.lastUsedAt && new Date(vmr.lastUsedAt) >= activeSince).length
        setActiveCount(total)
      } catch {
        // ignore — card will show fallback
      }
    }

    fetchActiveVmrs()
  }, [baseUrl, loaded, password, username])

  return (
    <StatsCard
      title="Active VMRs"
      value={activeCount ?? '—'}
      subtitle={activeCount !== null ? 'Used in last 30 days' : 'Configure credentials'}
      icon={Activity}
      color="green"
      href="/vmrs/static"
    />
  )
}
