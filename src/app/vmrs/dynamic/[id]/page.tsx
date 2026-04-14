'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { StatsCard } from '@/components/StatsCard'
import { ConferenceFrequencyChart } from '@/components/charts/ConferenceFrequencyChart'
import { formatRelativeTime, formatDateTime, formatDuration } from '@/lib/utils'
import { subDays, format } from 'date-fns'
import { Video, Users, TrendingUp } from 'lucide-react'

interface VMRDetail {
  id: number
  name: string
  lastUsedAt: string | null
  createdAt: string
  isStale: boolean
  stats: { totalConferences: number; totalParticipants: number; avgParticipants: number }
  conferences: {
    id: number
    startTime: string
    endTime: string | null
    callId: string | null
    participantCount: number
    participants: {
      id: number
      name: string | null
      joinTime: string
      leaveTime: string | null
    }[]
  }[]
}

function buildFrequencyData(conferences: VMRDetail['conferences']) {
  const dayMap: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    const d = subDays(new Date(), 29 - i)
    dayMap[format(d, 'yyyy-MM-dd')] = 0
  }
  for (const conf of conferences) {
    const key = format(new Date(conf.startTime), 'yyyy-MM-dd')
    if (key in dayMap) dayMap[key]++
  }
  return Object.entries(dayMap).map(([date, count]) => ({ date, count }))
}

export default function DynamicVMRDetailPage() {
  const params = useParams()
  const [vmr, setVmr] = useState<VMRDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedConf, setExpandedConf] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/vmrs/${params.id}`)
      .then(r => r.json())
      .then(setVmr)
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!vmr) return <div className="p-8 text-gray-500">VMR not found</div>

  const freqData = buildFrequencyData(vmr.conferences)

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/vmrs/dynamic" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} /> Back to Dynamic VMRs
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{vmr.name}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${vmr.isStale ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
            {vmr.isStale ? 'Stale' : 'Active'}
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-1">Last used: {formatRelativeTime(vmr.lastUsedAt)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard title="Total Conferences" value={vmr.stats.totalConferences} icon={Video} color="blue" />
        <StatsCard title="Total Participants" value={vmr.stats.totalParticipants} icon={Users} color="green" />
        <StatsCard title="Avg Participants" value={vmr.stats.avgParticipants} subtitle="Per conference" icon={TrendingUp} color="purple" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conference Frequency (Last 30 Days)</h2>
        <ConferenceFrequencyChart data={freqData} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Conferences</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {vmr.conferences.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-500">No conferences</p>
          ) : (
            vmr.conferences.map(conf => (
              <div key={conf.id}>
                <div
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedConf(expandedConf === conf.id ? null : conf.id)}
                >
                  {expandedConf === conf.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Start</p>
                      <p className="text-sm text-gray-900">{formatDateTime(conf.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">End</p>
                      <p className="text-sm text-gray-900">{conf.endTime ? formatDateTime(conf.endTime) : 'Ongoing'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm text-gray-900">{formatDuration(conf.startTime, conf.endTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Participants</p>
                      <p className="text-sm text-gray-900">{conf.participantCount}</p>
                    </div>
                  </div>
                </div>
                {expandedConf === conf.id && (
                  <div className="px-12 pb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left py-2">Name</th>
                          <th className="text-left py-2">Joined</th>
                          <th className="text-left py-2">Left</th>
                          <th className="text-left py-2">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conf.participants.map(p => (
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-2">{p.name ?? 'Unknown'}</td>
                            <td className="py-2 text-gray-600">{formatDateTime(p.joinTime)}</td>
                            <td className="py-2 text-gray-600">{p.leaveTime ? formatDateTime(p.leaveTime) : 'Still in call'}</td>
                            <td className="py-2 text-gray-600">{formatDuration(p.joinTime, p.leaveTime)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
