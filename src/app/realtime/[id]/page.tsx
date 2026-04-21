'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowDown, ArrowUp, Clock, Globe, Lock, Monitor, Phone, Shield, User } from 'lucide-react'
import { formatDateTime, formatDuration } from '@/lib/utils'
import { useCredentials } from '@/lib/credentials'

interface MediaStreamData {
  id: number
  streamId: string | null
  streamType: string
  rxBitrate: number | null
  rxCodec: string | null
  rxFps: number | null
  rxPacketLoss: number | null
  rxCurrentPacketLoss: number | null
  rxJitter: number | null
  rxPacketsLost: number | null
  rxPacketsRecv: number | null
  rxResolution: string | null
  txBitrate: number | null
  txCodec: string | null
  txFps: number | null
  txPacketLoss: number | null
  txCurrentPacketLoss: number | null
  txJitter: number | null
  txPacketsLost: number | null
  txPacketsSent: number | null
  txResolution: string | null
  startTime: string | null
  endTime: string | null
  node: string | null
  updatedAt?: string
}

interface LiveMediaStreamsResponse {
  source: 'live' | 'cached'
  fetchedAt: string
  warning?: string
  mediaStreams: MediaStreamData[]
}

interface QualityWindowData {
  id: number
  qualityWas: string | null
  qualityNow: string | null
  audioQuality: number | null
  videoQuality: number | null
  presentationQuality: number | null
  overallQuality: number | null
  rxPacketsLost: number | null
  rxPacketsRecv: number | null
  txPacketsLost: number | null
  txPacketsSent: number | null
  timestamp: string
}

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
  disconnectReason: string | null
  duration: number | null
  callQuality: string | null
  audioQuality: string | null
  videoQuality: string | null
  mediaStreams: MediaStreamData[]
  qualityWindows: QualityWindowData[]
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
    <span className="font-mono text-lg text-emerald-600 dark:text-emerald-400">
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ComponentType<any> }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700/30 last:border-0">
      {Icon && <Icon size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{value || '-'}</p>
      </div>
    </div>
  )
}

function qualityLabel(quality: string | null | undefined): string {
  if (!quality) return 'N/A'
  if (quality.includes('good')) return 'Good'
  if (quality.includes('ok')) return 'OK'
  if (quality.includes('bad')) return 'Bad'
  if (quality.includes('terrible')) return 'Terrible'
  if (quality.includes('unknown')) return 'Unknown'
  return quality
}

function qualityColor(quality: string | null | undefined): string {
  if (!quality) return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  if (quality.includes('good')) return 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
  if (quality.includes('ok')) return 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
  if (quality.includes('bad')) return 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
  if (quality.includes('terrible')) return 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

function qualityDot(quality: string | null | undefined): string {
  if (!quality) return 'bg-gray-300'
  if (quality.includes('good')) return 'bg-green-500'
  if (quality.includes('ok')) return 'bg-yellow-500'
  if (quality.includes('bad')) return 'bg-orange-500'
  if (quality.includes('terrible')) return 'bg-red-500'
  return 'bg-gray-400'
}

function qualityNumLabel(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-'
  switch (num) {
    case 1: return 'Good'
    case 2: return 'OK'
    case 3: return 'Bad'
    case 4: return 'Terrible'
    default: return 'Unknown'
  }
}

function qualityNumDot(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'bg-gray-300'
  switch (num) {
    case 1: return 'bg-green-500'
    case 2: return 'bg-yellow-400'
    case 3: return 'bg-orange-500'
    case 4: return 'bg-red-500'
    default: return 'bg-gray-400'
  }
}

function packetLossPercent(lost: number | null | undefined, total: number | null | undefined): string {
  if (!lost || !total || total === 0) return '0%'
  return ((lost / total) * 100).toFixed(2) + '%'
}

function formatLossPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)}%`
}

function lossColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'text-gray-400 dark:text-gray-500'
  if (value <= 0.05) return 'text-green-600 dark:text-green-400'
  if (value < 1) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined) return '-'
  return value.toFixed(fractionDigits)
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
}

function formatText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  return value
}

function streamTypeIcon(type: string): string {
  switch (type) {
    case 'audio': return '🔊'
    case 'video': return '📹'
    case 'presentation': return '🖥️'
    default: return '📡'
  }
}

export default function ParticipantDetailPage() {
  const params = useParams()
  const [participant, setParticipant] = useState<ParticipantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveMediaStreams, setLiveMediaStreams] = useState<MediaStreamData[] | null>(null)
  const [liveSource, setLiveSource] = useState<'live' | 'cached' | null>(null)
  const [liveWarning, setLiveWarning] = useState<string | null>(null)
  const [liveFetchedAt, setLiveFetchedAt] = useState<string | null>(null)
  const [liveAgeTick, setLiveAgeTick] = useState(0)
  const { baseUrl, username, password, loaded: credsLoaded } = useCredentials()

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

  // Auto-refresh participant detail (excluding mediaStreams which have their
  // own dedicated poll) for live participants.
  useEffect(() => {
    if (!participant || participant.leaveTime || participant.conference.endTime) return
    const interval = setInterval(() => {
      fetch(`/api/realtime/${params.id}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: ParticipantDetail | null) => {
          if (!data) return
          setParticipant(prev => {
            if (!prev) return data
            // Preserve previous mediaStreams to avoid re-render flashing in the
            // dedicated table; the live poll updates them separately.
            return { ...data, mediaStreams: prev.mediaStreams }
          })
        })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [participant, params.id])

  // Live media stream polling (5s) for active participants.
  useEffect(() => {
    if (!participant) return
    if (!credsLoaded) return
    if (participant.leaveTime || participant.conference.endTime) {
      // Past participants: clear any stale live state and stop polling.
      setLiveMediaStreams(null)
      setLiveSource(null)
      setLiveWarning(null)
      setLiveFetchedAt(null)
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/realtime/${params.id}/media-streams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl, username, password }),
        })
        if (!res.ok) return
        const data = (await res.json()) as LiveMediaStreamsResponse
        if (cancelled) return
        setLiveMediaStreams(data.mediaStreams)
        setLiveSource(data.source)
        setLiveWarning(data.warning ?? null)
        setLiveFetchedAt(data.fetchedAt)
      } catch {
        // ignore network errors; UI will fall back to last-known data
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [participant, params.id, baseUrl, username, password, credsLoaded])

  // Tick once a second so the "updated Xs ago" indicator stays current.
  useEffect(() => {
    if (!liveFetchedAt) return
    const interval = setInterval(() => setLiveAgeTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [liveFetchedAt])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>
  if (error || !participant) return (
    <div className="p-8">
      <Link href="/realtime" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4 transition-colors">
        <ArrowLeft size={16} /> Back to Real-time
      </Link>
      <p className="text-gray-500 dark:text-gray-400">{error || 'Participant not found'}</p>
    </div>
  )

  const isActive = !participant.leaveTime && !participant.conference.endTime

  return (
    <div className="p-8">
      <Link href="/realtime" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4 transition-colors">
        <ArrowLeft size={16} /> Back to Real-time
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${isActive ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
          <User size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {participant.name || 'Unknown Participant'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {isActive ? 'Connected' : 'Disconnected'}
            </span>
            {participant.callQuality && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${qualityColor(participant.callQuality)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(participant.callQuality)}`} />
                Quality: {qualityLabel(participant.callQuality)}
              </span>
            )}
            <Link
              href={`/vmrs/${participant.conference.vmr.id}`}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:underline"
            >
              {participant.conference.vmr.name}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Time */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Connection Time</h2>
          <div className="text-center py-4">
            {isActive ? (
              <>
                <LiveDuration joinTime={participant.joinTime} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Live duration</p>
              </>
            ) : (
              <>
                <span className="font-mono text-lg text-gray-700 dark:text-gray-300">
                  {participant.duration != null
                    ? `${Math.floor(participant.duration / 3600)}h ${Math.floor((participant.duration % 3600) / 60)}m ${Math.floor(participant.duration % 60)}s`
                    : formatDuration(participant.joinTime, participant.leaveTime ?? participant.conference.endTime)}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Total duration</p>
              </>
            )}
          </div>
          <div className="mt-4 space-y-0">
            <DetailRow label="Joined" value={formatDateTime(participant.joinTime)} icon={Clock} />
            <DetailRow label="Left" value={participant.leaveTime ? formatDateTime(participant.leaveTime) : participant.conference.endTime ? formatDateTime(participant.conference.endTime) : 'Still connected'} icon={Clock} />
            {participant.disconnectReason && (
              <DetailRow label="Disconnect Reason" value={participant.disconnectReason} />
            )}
          </div>
        </div>

        {/* Connection Details */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Connection Details</h2>
          <div className="space-y-0">
            <DetailRow label="Protocol" value={participant.protocol} icon={Globe} />
            <DetailRow label="Role" value={participant.role} icon={Shield} />
            <DetailRow label="Call Direction" value={participant.callDirection} icon={Phone} />
            <DetailRow label="Vendor / Client" value={participant.vendor} icon={Monitor} />
            <DetailRow label="Remote Address" value={participant.remoteAddress} icon={Globe} />
            <DetailRow label="Encryption" value={participant.encryption} icon={Lock} />
          </div>
        </div>

        {/* Call Quality Overview */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Call Quality</h2>
          {!participant.callQuality && participant.qualityWindows.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No quality data available yet</p>
          ) : (
            <>
              {/* Current quality badges */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-surface-dark rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Audio</p>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${qualityColor(participant.audioQuality)} px-2 py-0.5 rounded-full`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(participant.audioQuality)}`} />
                    {qualityLabel(participant.audioQuality)}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-surface-dark rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Video</p>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${qualityColor(participant.videoQuality)} px-2 py-0.5 rounded-full`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(participant.videoQuality)}`} />
                    {qualityLabel(participant.videoQuality)}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-surface-dark rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Overall</p>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${qualityColor(participant.callQuality)} px-2 py-0.5 rounded-full`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(participant.callQuality)}`} />
                    {qualityLabel(participant.callQuality)}
                  </span>
                </div>
              </div>

              {/* Latest packet loss */}
              {participant.qualityWindows.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">RX Packet Loss</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {packetLossPercent(participant.qualityWindows[0].rxPacketsLost, (participant.qualityWindows[0].rxPacketsLost ?? 0) + (participant.qualityWindows[0].rxPacketsRecv ?? 0))}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      {participant.qualityWindows[0].rxPacketsLost ?? 0} lost / {(participant.qualityWindows[0].rxPacketsLost ?? 0) + (participant.qualityWindows[0].rxPacketsRecv ?? 0)} total
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">TX Packet Loss</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {packetLossPercent(participant.qualityWindows[0].txPacketsLost, (participant.qualityWindows[0].txPacketsLost ?? 0) + (participant.qualityWindows[0].txPacketsSent ?? 0))}
                    </p>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400">
                      {participant.qualityWindows[0].txPacketsLost ?? 0} lost / {(participant.qualityWindows[0].txPacketsLost ?? 0) + (participant.qualityWindows[0].txPacketsSent ?? 0)} total
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bandwidth & Media */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Bandwidth &amp; Media</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ArrowDown size={14} className="text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Receive</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {participant.rxBandwidth != null ? participant.rxBandwidth : '-'}
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400">kbps</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ArrowUp size={14} className="text-emerald-500 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Transmit</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {participant.txBandwidth != null ? participant.txBandwidth : '-'}
              </p>
              <p className="text-xs text-emerald-500 dark:text-emerald-400">kbps</p>
            </div>
          </div>
          {(participant.rxBandwidth != null && participant.txBandwidth != null) && (
            <div className="bg-gray-50 dark:bg-surface-dark rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Total bandwidth</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{participant.rxBandwidth + participant.txBandwidth} kbps</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
                <span className="text-blue-500 dark:text-blue-400">RX {Math.round((participant.rxBandwidth / (participant.rxBandwidth + participant.txBandwidth)) * 100)}%</span>
                <span className="text-emerald-500 dark:text-emerald-400">TX {Math.round((participant.txBandwidth / (participant.rxBandwidth + participant.txBandwidth)) * 100)}%</span>
              </div>
            </div>
          )}
          <div className="space-y-0">
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Muted</p>
                <p className="text-sm text-gray-900">
                  {participant.isMuted === true && <span className="inline-flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500" /> Yes</span>}
                  {participant.isMuted === false && <span className="inline-flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500" /> No</span>}
                  {participant.isMuted == null && '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Presenting</p>
                <p className="text-sm text-gray-900">
                  {participant.isPresenting === true && <span className="inline-flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> Yes</span>}
                  {participant.isPresenting === false && <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-400" /> No</span>}
                  {participant.isPresenting == null && '-'}
                </p>
              </div>
            </div>
            <DetailRow label="Media Node" value={participant.mediaNode} />
            <DetailRow label="Signalling Node" value={participant.signallingNode} />
          </div>
        </div>

        {/* Identity & Aliases */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Identity &amp; Aliases</h2>
          <div className="space-y-0">
            <DetailRow label="Display Name" value={participant.name} icon={User} />
            <DetailRow label="Identity" value={participant.identity} />
            <DetailRow label="Source Alias" value={participant.sourceAlias} />
            <DetailRow label="Destination Alias" value={participant.destinationAlias} />
          </div>
        </div>

        {/* Conference Info */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Conference</h2>
          <div className="space-y-0">
            <DetailRow label="VMR" value={participant.conference.vmr.name} />
            <DetailRow label="Conference Started" value={formatDateTime(participant.conference.startTime)} icon={Clock} />
            <DetailRow label="Conference Ended" value={participant.conference.endTime ? formatDateTime(participant.conference.endTime) : 'Ongoing'} icon={Clock} />
            <DetailRow label="Conference Call ID" value={participant.conference.callId} />
            <DetailRow label="Participant Call UUID" value={participant.callUuid} />
          </div>
        </div>
      </div>

      {/* Media Streams - full width */}
      {(() => {
        const isActiveSession = !participant.leaveTime && !participant.conference.endTime
        const streams =
          isActiveSession && liveMediaStreams && liveMediaStreams.length > 0
            ? liveMediaStreams
            : participant.mediaStreams
        if (streams.length === 0 && !isActiveSession) return null

        const ageSeconds = liveFetchedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(liveFetchedAt).getTime()) / 1000))
          : null
        // Note: `liveAgeTick` is what makes the indicator below re-render every
        // second; it doesn't need to appear in this expression.

        return (
          <div className="mt-6 glass-card rounded-2xl shadow-glass p-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Conferencing node media streams
              </h2>
              {isActiveSession && liveSource && (
                <span
                  data-tick={liveAgeTick}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    liveSource === 'live'
                      ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      liveSource === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  {liveSource === 'live'
                    ? `Live${ageSeconds !== null ? ` • updated ${ageSeconds}s ago` : ''}`
                    : 'Snapshot'}
                </span>
              )}
            </div>

            {liveWarning && (
              <div className="mb-3 p-3 rounded-lg text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300">
                {liveWarning}
              </div>
            )}

            {streams.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                No media streams reported yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700/40 text-gray-500 dark:text-gray-400">
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Type</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Start time</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Node</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Tx codec</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Tx bitrate (kbps)</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Tx resolution</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Tx framerate</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Tx packets sent</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Tx packets lost</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Tx current packet loss</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Tx jitter (ms)</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Rx codec</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Rx bitrate (kbps)</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Rx resolution</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Rx framerate</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Rx packets received</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Rx packets lost</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Rx current packet loss</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Rx jitter (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streams.map(ms => (
                      <tr
                        key={ms.id}
                        className="border-b border-gray-50 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200"
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span>{streamTypeIcon(ms.streamType)}</span>
                            <span className="capitalize">{ms.streamType}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {ms.startTime ? formatDateTime(ms.startTime) : '-'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">{formatText(ms.node)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{formatText(ms.txCodec)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatInteger(ms.txBitrate)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{formatText(ms.txResolution)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatNumber(ms.txFps, 1)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatInteger(ms.txPacketsSent)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatInteger(ms.txPacketsLost)}</td>
                        <td className={`py-2 px-3 text-right whitespace-nowrap ${lossColorClass(ms.txCurrentPacketLoss)}`}>
                          {formatLossPercent(ms.txCurrentPacketLoss)}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatNumber(ms.txJitter, 1)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{formatText(ms.rxCodec)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatInteger(ms.rxBitrate)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{formatText(ms.rxResolution)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatNumber(ms.rxFps, 1)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatInteger(ms.rxPacketsRecv)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatInteger(ms.rxPacketsLost)}</td>
                        <td className={`py-2 px-3 text-right whitespace-nowrap ${lossColorClass(ms.rxCurrentPacketLoss)}`}>
                          {formatLossPercent(ms.rxCurrentPacketLoss)}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatNumber(ms.rxJitter, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {streams.length} {streams.length === 1 ? 'media stream' : 'media streams'}
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Quality History */}
      {participant.qualityWindows.length > 0 && (
        <div className="mt-6 glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Quality History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Time</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Transition</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Audio</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Video</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Presentation</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Overall</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">RX Loss</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">TX Loss</th>
                </tr>
              </thead>
              <tbody>
                {participant.qualityWindows.map(qw => (
                  <tr key={qw.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700 whitespace-nowrap">{formatDateTime(qw.timestamp)}</td>
                    <td className="py-2 px-3">
                      {qw.qualityWas && qw.qualityNow ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(qw.qualityWas)}`} />
                          <span className="text-gray-400">→</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(qw.qualityNow)}`} />
                          <span className="text-gray-600 dark:text-gray-400">{qualityLabel(qw.qualityNow)}</span>
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 ${qualityNumDot(qw.audioQuality) !== 'bg-gray-300' ? '' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.audioQuality)}`} />
                        {qualityNumLabel(qw.audioQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 ${qualityNumDot(qw.videoQuality) !== 'bg-gray-300' ? '' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.videoQuality)}`} />
                        {qualityNumLabel(qw.videoQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 ${qualityNumDot(qw.presentationQuality) !== 'bg-gray-300' ? '' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.presentationQuality)}`} />
                        {qualityNumLabel(qw.presentationQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 ${qualityNumDot(qw.overallQuality) !== 'bg-gray-300' ? '' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.overallQuality)}`} />
                        {qualityNumLabel(qw.overallQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">
                      {packetLossPercent(qw.rxPacketsLost, (qw.rxPacketsLost ?? 0) + (qw.rxPacketsRecv ?? 0))}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">
                      {packetLossPercent(qw.txPacketsLost, (qw.txPacketsLost ?? 0) + (qw.txPacketsSent ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
