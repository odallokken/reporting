'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowDown, ArrowUp, Clock, Globe, Lock, Monitor, Phone, Shield, User } from 'lucide-react'
import { formatDateTime, formatDuration } from '@/lib/utils'

interface ParticipantDetail {
  id: number
  name: string | null
  identity: string | null
  joinTime: string
  leaveTime: string | null
  callUuid: string | null
  protocol: string | null
  role: string | null
  sourceAlias: string | null
  destinationAlias: string | null
  callDirection: string | null
  remoteAddress: string | null
  vendor: string | null
  rxBandwidth: number | null
  txBandwidth: number | null
  mediaNode: string | null
  signallingNode: string | null
  encryption: string | null
  isMuted: boolean | null
  isPresenting: boolean | null
  conference: {
    id: number
    startTime: string
    endTime: string | null
    callId: string | null
    vmr: { id: number; name: string }
  }
}

function LiveDuration({ joinTime }: { joinTime: string }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const start = new Date(joinTime)
  const diffMs = now.getTime() - start.getTime()
  const seconds = Math.floor(diffMs / 1000) % 60
  const minutes = Math.floor(diffMs / 60000) % 60
  const hours = Math.floor(diffMs / 3600000)

  const pad = (n: number) => n.toString().padStart(2, '0')

  return (
    <span className="font-mono text-lg text-green-600">
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ComponentType<any> }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      {Icon && <Icon size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900 break-all">{value || '-'}</p>
      </div>
    </div>
  )
}

export default function ParticipantDetailPage() {
  const params = useParams()
  const [participant, setParticipant] = useState<ParticipantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/realtime/${params.id}`)
      .then(r => {
        if (!r.ok) throw new Error('Participant not found')
        return r.json()
      })
      .then(setParticipant)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.id])

  // Auto-refresh for live participants
  useEffect(() => {
    if (!participant || participant.leaveTime) return
    const interval = setInterval(() => {
      fetch(`/api/realtime/${params.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setParticipant(data) })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [participant, params.id])

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (error || !participant) return (
    <div className="p-8">
      <Link href="/realtime" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Back to Real-time
      </Link>
      <p className="text-gray-500">{error || 'Participant not found'}</p>
    </div>
  )

  const isActive = !participant.leaveTime

  return (
    <div className="p-8">
      <Link href="/realtime" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Back to Real-time
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
          <User size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {participant.name || 'Unknown Participant'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isActive ? 'Connected' : 'Disconnected'}
            </span>
            <Link
              href={`/vmrs/${participant.conference.vmr.id}`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {participant.conference.vmr.name}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Time */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Connection Time</h2>
          <div className="text-center py-4">
            {isActive ? (
              <>
                <LiveDuration joinTime={participant.joinTime} />
                <p className="text-xs text-gray-500 mt-2">Live duration</p>
              </>
            ) : (
              <>
                <span className="font-mono text-lg text-gray-700">
                  {formatDuration(participant.joinTime, participant.leaveTime)}
                </span>
                <p className="text-xs text-gray-500 mt-2">Total duration</p>
              </>
            )}
          </div>
          <div className="mt-4 space-y-0">
            <DetailRow label="Joined" value={formatDateTime(participant.joinTime)} icon={Clock} />
            <DetailRow label="Left" value={participant.leaveTime ? formatDateTime(participant.leaveTime) : 'Still connected'} icon={Clock} />
          </div>
        </div>

        {/* Connection Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Connection Details</h2>
          <div className="space-y-0">
            <DetailRow label="Protocol" value={participant.protocol} icon={Globe} />
            <DetailRow label="Role" value={participant.role} icon={Shield} />
            <DetailRow label="Call Direction" value={participant.callDirection} icon={Phone} />
            <DetailRow label="Vendor / Client" value={participant.vendor} icon={Monitor} />
            <DetailRow label="Remote Address" value={participant.remoteAddress} icon={Globe} />
            <DetailRow label="Encryption" value={participant.encryption} icon={Lock} />
          </div>
        </div>

        {/* Bandwidth & Media */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Bandwidth &amp; Media</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ArrowDown size={14} className="text-blue-500" />
                <span className="text-xs font-medium text-blue-600 uppercase">Receive</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {participant.rxBandwidth != null ? participant.rxBandwidth : '-'}
              </p>
              <p className="text-xs text-blue-500">kbps</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ArrowUp size={14} className="text-green-500" />
                <span className="text-xs font-medium text-green-600 uppercase">Transmit</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {participant.txBandwidth != null ? participant.txBandwidth : '-'}
              </p>
              <p className="text-xs text-green-500">kbps</p>
            </div>
          </div>
          {(participant.rxBandwidth != null && participant.txBandwidth != null) && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Total bandwidth</span>
                <span className="font-medium text-gray-700">{participant.rxBandwidth + participant.txBandwidth} kbps</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-400"
                    style={{ width: `${(participant.rxBandwidth / (participant.rxBandwidth + participant.txBandwidth)) * 100}%` }}
                  />
                  <div
                    className="bg-green-400"
                    style={{ width: `${(participant.txBandwidth / (participant.rxBandwidth + participant.txBandwidth)) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-blue-500">RX {Math.round((participant.rxBandwidth / (participant.rxBandwidth + participant.txBandwidth)) * 100)}%</span>
                <span className="text-green-500">TX {Math.round((participant.txBandwidth / (participant.rxBandwidth + participant.txBandwidth)) * 100)}%</span>
              </div>
            </div>
          )}
          <div className="space-y-0">
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Muted</p>
                <p className="text-sm text-gray-900">
                  {participant.isMuted === true && <span className="inline-flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500" /> Yes</span>}
                  {participant.isMuted === false && <span className="inline-flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500" /> No</span>}
                  {participant.isMuted == null && '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Presenting</p>
                <p className="text-sm text-gray-900">
                  {participant.isPresenting === true && <span className="inline-flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> Yes</span>}
                  {participant.isPresenting === false && <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-2 h-2 rounded-full bg-gray-400" /> No</span>}
                  {participant.isPresenting == null && '-'}
                </p>
              </div>
            </div>
            <DetailRow label="Media Node" value={participant.mediaNode} />
            <DetailRow label="Signalling Node" value={participant.signallingNode} />
          </div>
        </div>

        {/* Identity & Aliases */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Identity &amp; Aliases</h2>
          <div className="space-y-0">
            <DetailRow label="Display Name" value={participant.name} icon={User} />
            <DetailRow label="Identity" value={participant.identity} />
            <DetailRow label="Source Alias" value={participant.sourceAlias} />
            <DetailRow label="Destination Alias" value={participant.destinationAlias} />
          </div>
        </div>

        {/* Conference Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Conference</h2>
          <div className="space-y-0">
            <DetailRow label="VMR" value={participant.conference.vmr.name} />
            <DetailRow label="Conference Started" value={formatDateTime(participant.conference.startTime)} icon={Clock} />
            <DetailRow label="Conference Ended" value={participant.conference.endTime ? formatDateTime(participant.conference.endTime) : 'Ongoing'} icon={Clock} />
            <DetailRow label="Conference Call ID" value={participant.conference.callId} />
            <DetailRow label="Participant Call UUID" value={participant.callUuid} />
          </div>
        </div>
      </div>
    </div>
  )
}
