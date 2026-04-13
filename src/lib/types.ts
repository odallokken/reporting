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

export interface PexipEvent {
  event: string
  conference: string
  participant_name?: string
  call_uuid?: string
  call_id?: string
  timestamp: string
}
