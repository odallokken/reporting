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
  totalVmrs: number
  activeVmrs: number
  staleVmrs: number
  totalConferences: number
  totalParticipants: number
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
    vmr: { id: number; name: string }
  }
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
}

export interface PexipEvent {
  event: string
  node: string
  seq: number
  version: number
  time: number
  data: PexipEventData | PexipEvent[]
}
