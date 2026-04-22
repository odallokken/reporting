'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Activity,
  Clock,
  Globe,
  Lock,
  MicOff,
  Mic,
  Monitor,
  MonitorPlay,
  Phone,
  Server,
  Shield,
  Signal,
  User,
  Volume2,
  Video,
  Presentation,
  Radio,
} from 'lucide-react'
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

function streamTypeIcon(type: string) {
  switch (type) {
    case 'audio': return Volume2
    case 'video': return Video
    case 'presentation': return Presentation
    default: return Radio
  }
}

function streamTypeAccent(type: string): { bar: string; chip: string; text: string } {
  switch (type) {
    case 'audio':
      return {
        bar: 'bg-purple-500',
        chip: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300',
        text: 'text-purple-600 dark:text-purple-300',
      }
    case 'video':
      return {
        bar: 'bg-blue-500',
        chip: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300',
        text: 'text-blue-600 dark:text-blue-300',
      }
    case 'presentation':
      return {
        bar: 'bg-amber-500',
        chip: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
        text: 'text-amber-600 dark:text-amber-300',
      }
    default:
      return {
        bar: 'bg-gray-400',
        chip: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
        text: 'text-gray-600 dark:text-gray-300',
      }
  }
}

function jitterColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'text-gray-400 dark:text-gray-500'
  if (value < 30) return 'text-green-600 dark:text-green-400'
  if (value < 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function formatBitrateKbps(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (value >= 1000) return `${(value / 1000).toFixed(1)} Mbps`
  return `${formatInteger(value)} kbps`
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
  const isActiveSession = isActive
  const totalBandwidth = (participant.rxBandwidth ?? 0) + (participant.txBandwidth ?? 0)
  const latestQuality = participant.qualityWindows[0] ?? null
  const liveStreamsForRender =
    isActiveSession && liveMediaStreams && liveMediaStreams.length > 0
      ? liveMediaStreams
      : participant.mediaStreams
  const ageSeconds = liveFetchedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(liveFetchedAt).getTime()) / 1000))
    : null

  const formattedDuration = participant.duration != null
    ? `${Math.floor(participant.duration / 3600)}h ${Math.floor((participant.duration % 3600) / 60)}m ${Math.floor(participant.duration % 60)}s`
    : formatDuration(participant.joinTime, participant.leaveTime ?? participant.conference.endTime)

  return (
    <div className="p-8 space-y-6">
      <Link href="/realtime" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-2 transition-colors w-fit">
        <ArrowLeft size={16} /> Back to Real-time
      </Link>

      {/* Hero header */}
      <div className="glass-card rounded-2xl shadow-glass p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
              <User size={26} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                {participant.name || 'Unknown Participant'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
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
                {participant.protocol && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300">
                    <Globe size={12} />
                    {participant.protocol}
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

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:max-w-xl lg:flex-1">
            <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white/40 dark:bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</p>
              {isActive ? (
                <LiveDuration joinTime={participant.joinTime} />
              ) : (
                <p className="font-mono text-lg text-gray-900 dark:text-gray-100 mt-0.5">{formattedDuration}</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white/40 dark:bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1"><ArrowDown size={11} /> RX</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{participant.rxBandwidth != null ? formatInteger(participant.rxBandwidth) : '-'}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">kbps</p>
            </div>
            <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white/40 dark:bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1"><ArrowUp size={11} /> TX</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{participant.txBandwidth != null ? formatInteger(participant.txBandwidth) : '-'}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">kbps</p>
            </div>
            <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white/40 dark:bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1"><Lock size={11} /> Encryption</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1 truncate">{participant.encryption || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: bandwidth + quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bandwidth & Media */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Bandwidth &amp; Media</h2>
            <Activity size={16} className="text-gray-400 dark:text-gray-500" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
                  <ArrowDown size={12} /> Receive
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {participant.rxBandwidth != null ? formatInteger(participant.rxBandwidth) : '-'}
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400">kbps</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1">
                  <ArrowUp size={12} /> Transmit
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {participant.txBandwidth != null ? formatInteger(participant.txBandwidth) : '-'}
              </p>
              <p className="text-xs text-emerald-500 dark:text-emerald-400">kbps</p>
            </div>
          </div>
          {totalBandwidth > 0 && (
            <div className="rounded-xl bg-gray-50 dark:bg-surface-dark p-3 mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-500 dark:text-gray-400">Total bandwidth</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{formatInteger(totalBandwidth)} kbps</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                <div
                  className="bg-blue-500"
                  style={{ width: `${((participant.rxBandwidth ?? 0) / totalBandwidth) * 100}%` }}
                />
                <div
                  className="bg-emerald-500"
                  style={{ width: `${((participant.txBandwidth ?? 0) / totalBandwidth) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] mt-1">
                <span className="text-blue-600 dark:text-blue-400">RX {Math.round(((participant.rxBandwidth ?? 0) / totalBandwidth) * 100)}%</span>
                <span className="text-emerald-600 dark:text-emerald-400">TX {Math.round(((participant.txBandwidth ?? 0) / totalBandwidth) * 100)}%</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-100 dark:border-gray-700/40 px-3 py-2.5">
              <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500 tracking-wider mb-1">Muted</p>
              <span className="inline-flex items-center gap-1.5 text-sm">
                {participant.isMuted === true && <><MicOff size={14} className="text-red-500" /><span className="text-red-600 dark:text-red-400">Yes</span></>}
                {participant.isMuted === false && <><Mic size={14} className="text-green-500" /><span className="text-green-600 dark:text-green-400">No</span></>}
                {participant.isMuted == null && <span className="text-gray-400">—</span>}
              </span>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-gray-700/40 px-3 py-2.5">
              <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500 tracking-wider mb-1">Presenting</p>
              <span className="inline-flex items-center gap-1.5 text-sm">
                {participant.isPresenting === true && <><MonitorPlay size={14} className="text-blue-500" /><span className="text-blue-600 dark:text-blue-400">Yes</span></>}
                {participant.isPresenting === false && <><Monitor size={14} className="text-gray-500" /><span className="text-gray-600 dark:text-gray-400">No</span></>}
                {participant.isPresenting == null && <span className="text-gray-400">—</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Call Quality */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Call Quality</h2>
            <Signal size={16} className="text-gray-400 dark:text-gray-500" />
          </div>
          {!participant.callQuality && participant.qualityWindows.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No quality data available yet</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-surface-dark rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Audio</p>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${qualityColor(participant.audioQuality)} px-2 py-0.5 rounded-full`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(participant.audioQuality)}`} />
                    {qualityLabel(participant.audioQuality)}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-surface-dark rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Video</p>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${qualityColor(participant.videoQuality)} px-2 py-0.5 rounded-full`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(participant.videoQuality)}`} />
                    {qualityLabel(participant.videoQuality)}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-surface-dark rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Overall</p>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${qualityColor(participant.callQuality)} px-2 py-0.5 rounded-full`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityDot(participant.callQuality)}`} />
                    {qualityLabel(participant.callQuality)}
                  </span>
                </div>
              </div>

              {latestQuality && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">RX Packet Loss</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {packetLossPercent(latestQuality.rxPacketsLost, (latestQuality.rxPacketsLost ?? 0) + (latestQuality.rxPacketsRecv ?? 0))}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      {formatInteger(latestQuality.rxPacketsLost ?? 0)} lost / {formatInteger((latestQuality.rxPacketsLost ?? 0) + (latestQuality.rxPacketsRecv ?? 0))} total
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">TX Packet Loss</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {packetLossPercent(latestQuality.txPacketsLost, (latestQuality.txPacketsLost ?? 0) + (latestQuality.txPacketsSent ?? 0))}
                    </p>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400">
                      {formatInteger(latestQuality.txPacketsLost ?? 0)} lost / {formatInteger((latestQuality.txPacketsLost ?? 0) + (latestQuality.txPacketsSent ?? 0))} total
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
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

        {/* Conference & Nodes */}
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Conference &amp; Nodes</h2>
          <div className="space-y-0">
            <DetailRow label="VMR" value={participant.conference.vmr.name} icon={User} />
            <DetailRow label="Conference Started" value={formatDateTime(participant.conference.startTime)} icon={Clock} />
            <DetailRow label="Conference Ended" value={participant.conference.endTime ? formatDateTime(participant.conference.endTime) : 'Ongoing'} icon={Clock} />
            <DetailRow label="Joined" value={formatDateTime(participant.joinTime)} icon={Clock} />
            <DetailRow label="Left" value={participant.leaveTime ? formatDateTime(participant.leaveTime) : participant.conference.endTime ? formatDateTime(participant.conference.endTime) : 'Still connected'} icon={Clock} />
            {participant.disconnectReason && (
              <DetailRow label="Disconnect Reason" value={participant.disconnectReason} />
            )}
            <DetailRow label="Media Node" value={participant.mediaNode} icon={Server} />
            <DetailRow label="Signalling Node" value={participant.signallingNode} icon={Server} />
          </div>
        </div>
      </div>

      {/* Identity & Aliases (full width compact strip) */}
      <div className="glass-card rounded-2xl shadow-glass p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Identity &amp; Aliases</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Display Name</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{participant.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Identity</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{participant.identity || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Source Alias</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{participant.sourceAlias || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Destination Alias</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{participant.destinationAlias || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Conference Call ID</p>
            <p className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">{participant.conference.callId || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Participant Call UUID</p>
            <p className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">{participant.callUuid || '—'}</p>
          </div>
        </div>
      </div>

      {/* Media Streams - redesigned */}
      {(() => {
        if (liveStreamsForRender.length === 0 && !isActiveSession) return null

        return (
          <div className="glass-card rounded-2xl shadow-glass p-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Conferencing node media streams
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Per-stream codec, bitrate, packet-loss and jitter snapshots from the Pexip Management Node.</p>
              </div>
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
              <div className="mb-4 p-3 rounded-lg text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300">
                {liveWarning}
              </div>
            )}

            {liveStreamsForRender.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
                No media streams reported yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {liveStreamsForRender.map((ms) => {
                  const Icon = streamTypeIcon(ms.streamType)
                  const accent = streamTypeAccent(ms.streamType)
                  return (
                    <div
                      key={ms.id}
                      className="relative overflow-hidden rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white/40 dark:bg-white/5"
                    >
                      <div className={`absolute top-0 left-0 h-full w-1 ${accent.bar}`} />
                      <div className="p-4 pl-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${accent.chip}`}>
                              <Icon size={16} />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{ms.streamType}</p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {ms.startTime ? `Started ${formatDateTime(ms.startTime)}` : 'Start time unknown'}
                              </p>
                            </div>
                          </div>
                          {ms.node && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                              <Server size={11} />
                              {ms.node}
                            </span>
                          )}
                        </div>

                        {/* TX / RX columns */}
                        <div className="grid grid-cols-2 gap-3">
                          <DirectionBlock
                            label="Transmit"
                            arrow="up"
                            codec={ms.txCodec}
                            bitrate={ms.txBitrate}
                            resolution={ms.txResolution}
                            fps={ms.txFps}
                            packets={ms.txPacketsSent}
                            packetsLabel="sent"
                            packetsLost={ms.txPacketsLost}
                            currentLoss={ms.txCurrentPacketLoss}
                            jitter={ms.txJitter}
                          />
                          <DirectionBlock
                            label="Receive"
                            arrow="down"
                            codec={ms.rxCodec}
                            bitrate={ms.rxBitrate}
                            resolution={ms.rxResolution}
                            fps={ms.rxFps}
                            packets={ms.rxPacketsRecv}
                            packetsLabel="received"
                            packetsLost={ms.rxPacketsLost}
                            currentLoss={ms.rxCurrentPacketLoss}
                            jitter={ms.rxJitter}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {liveStreamsForRender.length > 0 && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {liveStreamsForRender.length} {liveStreamsForRender.length === 1 ? 'media stream' : 'media streams'}
              </p>
            )}
          </div>
        )
      })()}

      {/* Quality History */}
      {participant.qualityWindows.length > 0 && (
        <div className="glass-card rounded-2xl shadow-glass p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Quality History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700/40">
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Time</th>
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Transition</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Audio</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Video</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Presentation</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Overall</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">RX Loss</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">TX Loss</th>
                </tr>
              </thead>
              <tbody>
                {participant.qualityWindows.map(qw => (
                  <tr key={qw.id} className="border-b border-gray-50 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200">
                    <td className="py-2 px-3 whitespace-nowrap">{formatDateTime(qw.timestamp)}</td>
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
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.audioQuality)}`} />
                        {qualityNumLabel(qw.audioQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.videoQuality)}`} />
                        {qualityNumLabel(qw.videoQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.presentationQuality)}`} />
                        {qualityNumLabel(qw.presentationQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${qualityNumDot(qw.overallQuality)}`} />
                        {qualityNumLabel(qw.overallQuality)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {packetLossPercent(qw.rxPacketsLost, (qw.rxPacketsLost ?? 0) + (qw.rxPacketsRecv ?? 0))}
                    </td>
                    <td className="py-2 px-3 text-right">
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

function DirectionBlock({
  label,
  arrow,
  codec,
  bitrate,
  resolution,
  fps,
  packets,
  packetsLabel,
  packetsLost,
  currentLoss,
  jitter,
}: {
  label: string
  arrow: 'up' | 'down'
  codec: string | null | undefined
  bitrate: number | null | undefined
  resolution: string | null | undefined
  fps: number | null | undefined
  packets: number | null | undefined
  packetsLabel: string
  packetsLost: number | null | undefined
  currentLoss: number | null | undefined
  jitter: number | null | undefined
}) {
  const Arrow = arrow === 'up' ? ArrowUp : ArrowDown
  const accent = arrow === 'up'
    ? { text: 'text-emerald-600 dark:text-emerald-400', tint: 'bg-emerald-50 dark:bg-emerald-500/5' }
    : { text: 'text-blue-600 dark:text-blue-400', tint: 'bg-blue-50 dark:bg-blue-500/5' }
  return (
    <div className={`rounded-lg p-3 ${accent.tint}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${accent.text} flex items-center gap-1`}>
          <Arrow size={11} />
          {label}
        </span>
        <span className={`text-[10px] font-mono ${accent.text}`}>{formatText(codec)}</span>
      </div>
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{formatBitrateKbps(bitrate)}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {formatText(resolution)}{fps != null ? ` @ ${formatNumber(fps, 1)} fps` : ''}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
        <div className="text-gray-500 dark:text-gray-400">Packets {packetsLabel}</div>
        <div className="text-right text-gray-700 dark:text-gray-200">{formatInteger(packets)}</div>
        <div className="text-gray-500 dark:text-gray-400">Packets lost</div>
        <div className="text-right text-gray-700 dark:text-gray-200">{formatInteger(packetsLost)}</div>
        <div className="text-gray-500 dark:text-gray-400">Current loss</div>
        <div className={`text-right font-medium ${lossColorClass(currentLoss)}`}>{formatLossPercent(currentLoss)}</div>
        <div className="text-gray-500 dark:text-gray-400">Jitter</div>
        <div className={`text-right font-medium ${jitterColorClass(jitter)}`}>{jitter != null ? `${formatNumber(jitter, 1)} ms` : '-'}</div>
      </div>
    </div>
  )
}
