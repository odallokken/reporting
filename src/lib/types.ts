export interface VMRWithStats {
  id: number
  name: string
  lastUsedAt: string | null
  createdAt: string
  totalCalls: number
  totalParticipants: number
  isStale: boolean
}

export interface ConferenceWithDetails {
  id: number
  vmrId: number
  startTime: string
  endTime: string | null
  callId: string | null
  createdAt: string
  vmr?: { id: number; name: string }
  participants?: ParticipantRecord[]
  _count?: { participants: number }
}

export interface ParticipantRecord {
  id: number
  conferenceId: number
  name: string | null
  identity: string | null
  joinTime: string
  leaveTime: string | null
  callUuid: string | null
  createdAt: string
}

export interface DashboardStats {
  activeVmrs: number
  activeConferences: number
  activeParticipants: number
  recentActivity: RecentEvent[]
  usageByDay: { date: string; count: number }[]
  topVmrs: { name: string; count: number }[]
}

export interface RecentEvent {
  id: number
  name: string | null
  joinTime: string
  leaveTime: string | null
  conference: {
    id: number
    endTime: string | null
    vmr: { id: number; name: string }
  }
}

export interface StaticVMR {
  id: number
  name: string
  description: string
  aliases: { alias: string }[]
  pin: string | null
  guest_pin: string | null
  allow_guests: boolean
  tag: string | null
  service_type: string | null
  lastUsedAt: string | null
  totalConferences: number
}

export interface PacketLossEntry {
  tx_packets_lost: number
  stream_id: string
  time_delta: number
  tx_packets_sent: number
  rx_packets_received: number
  rx_packets_lost: number
  time: number
  stream_type: string
}

export interface QualityEntry {
  applicationsharing: number | null
  quality: number | null
  video: number | null
  time_delta: number
  time: number
  audio: number | null
  presentation: number | null
}

export interface MediaStreamEntry {
  end_time: number
  node: string
  rx_bitrate: number
  rx_codec: string
  rx_fps: number
  rx_packet_loss: number
  rx_packets_lost: number
  rx_packets_received: number
  rx_resolution: string
  start_time: number
  stream_id: string
  stream_type: string
  tx_bitrate: number
  tx_codec: string
  tx_fps: number
  tx_packet_loss: number
  tx_packets_lost: number
  tx_packets_sent: number
  tx_resolution: string
}

export interface PexipEventData {
  // Conference events
  name?: string
  start_time?: number
  end_time?: number
  service_type?: string
  // Participant events
  conference?: string
  display_name?: string
  uuid?: string
  call_id?: string
  connect_time?: number
  disconnect_reason?: string
  duration?: number
  protocol?: string
  role?: string
  source_alias?: string
  destination_alias?: string
  call_direction?: string
  remote_address?: string
  vendor?: string
  rx_bandwidth?: number
  tx_bandwidth?: number
  media_node?: string
  signalling_node?: string
  encryption?: string
  is_muted?: boolean
  is_presenting?: boolean
  has_media?: boolean
  // Quality events (participant_media_stream_window)
  packet_loss_history?: PacketLossEntry[]
  recent_quality?: QualityEntry[]
  call_quality_was?: string
  call_quality_now?: string
  // Media stream events (participant_media_streams_destroyed / participant_disconnected v2)
  media_streams?: MediaStreamEntry[]
}

export interface PexipEvent {
  event: string
  node: string
  seq: number
  version: number
  time: number
  data: PexipEventData | PexipEvent[]
}
