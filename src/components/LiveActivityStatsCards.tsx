'use client'

import { useEffect, useState } from 'react'
import { Users, Wifi } from 'lucide-react'
import { StatsCard } from './StatsCard'

interface LiveActivityStatsCardsProps {
  initialActiveConferences: number
  initialActiveParticipants: number
}

export function LiveActivityStatsCards({
  initialActiveConferences,
  initialActiveParticipants,
}: LiveActivityStatsCardsProps) {
  const [activeConferences, setActiveConferences] = useState(initialActiveConferences)
  const [activeParticipants, setActiveParticipants] = useState(initialActiveParticipants)

  useEffect(() => {
    const fetchLiveCounts = async () => {
      try {
        const response = await fetch('/api/dashboard', { cache: 'no-store' })
        if (!response.ok) return

        const data = await response.json() as {
          activeConferences?: number
          activeParticipants?: number
        }

        setActiveConferences(data.activeConferences ?? 0)
        setActiveParticipants(data.activeParticipants ?? 0)
      } catch {
        // ignore and keep the last successful values
      }
    }

    fetchLiveCounts()
    const interval = window.setInterval(fetchLiveCounts, 30000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <>
      <StatsCard title="Active Conferences" value={activeConferences} subtitle="Right now" icon={Wifi} color="green" href="/realtime" />
      <StatsCard title="Active Participants" value={activeParticipants} subtitle="Right now" icon={Users} color="teal" href="/realtime" />
    </>
  )
}
