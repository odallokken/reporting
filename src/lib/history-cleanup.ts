import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type CleanupConference = {
  id: number
  vmrId: number
  historyId: string | null
  callId: string | null
  startTime: Date
  endTime: Date | null
  createdAt: Date
  participants: CleanupParticipant[]
}

type CleanupParticipant = {
  id: number
  conferenceId: number
  name: string | null
  identity: string | null
  sourceAlias: string | null
  destinationAlias: string | null
  remoteAddress: string | null
  callUuid: string | null
  joinTime: Date
  leaveTime: Date | null
  duration: number | null
  protocol: string | null
  role: string | null
  callDirection: string | null
  vendor: string | null
  encryption: string | null
  disconnectReason: string | null
  createdAt: Date
  mediaStreams: Array<{ id: number }>
  qualityWindows: Array<{ id: number }>
}

export type HistoryCleanupResult = {
  duplicateConferenceGroups: number
  deletedConferences: number
  mergedParticipants: number
  movedParticipants: number
  deletedParticipants: number
  reparentedMediaStreams: number
  reparentedQualityWindows: number
}

export async function cleanupHistoricalDuplicates(): Promise<HistoryCleanupResult> {
  const conferences = await prisma.conference.findMany({
    include: {
      participants: {
        select: {
          id: true,
          conferenceId: true,
          name: true,
          identity: true,
          sourceAlias: true,
          destinationAlias: true,
          remoteAddress: true,
          callUuid: true,
          joinTime: true,
          leaveTime: true,
          duration: true,
          protocol: true,
          role: true,
          callDirection: true,
          vendor: true,
          encryption: true,
          disconnectReason: true,
          createdAt: true,
          mediaStreams: { select: { id: true } },
          qualityWindows: { select: { id: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  const duplicateGroups = Array.from(groupBy(conferences, getConferenceDuplicateKey).values())
    .filter((group) => group.length > 1)

  const result: HistoryCleanupResult = {
    duplicateConferenceGroups: duplicateGroups.length,
    deletedConferences: 0,
    mergedParticipants: 0,
    movedParticipants: 0,
    deletedParticipants: 0,
    reparentedMediaStreams: 0,
    reparentedQualityWindows: 0,
  }

  if (duplicateGroups.length === 0) {
    return result
  }

  await prisma.$transaction(async (tx) => {
    const touchedConferenceIds = new Set<number>()

    for (const group of duplicateGroups) {
      const canonicalConference = chooseCanonicalConference(group)
      touchedConferenceIds.add(canonicalConference.id)

      for (const duplicateConference of group) {
        if (duplicateConference.id === canonicalConference.id) continue

        for (const participant of duplicateConference.participants) {
          const merged = await mergeParticipantIntoConference(tx, canonicalConference.id, participant)
          if (merged.merged) {
            result.mergedParticipants += 1
            result.deletedParticipants += 1
            result.reparentedMediaStreams += participant.mediaStreams.length
            result.reparentedQualityWindows += participant.qualityWindows.length
          } else if (merged.moved) {
            result.movedParticipants += 1
          }
        }

        await tx.conference.delete({ where: { id: duplicateConference.id } })
        result.deletedConferences += 1
      }

      const conferenceUpdate = buildConferenceUpdate(canonicalConference, group)
      if (Object.keys(conferenceUpdate).length > 0) {
        await tx.conference.update({
          where: { id: canonicalConference.id },
          data: conferenceUpdate,
        })
      }
    }

    for (const conferenceId of touchedConferenceIds) {
      const deduped = await dedupeParticipantsWithinConference(tx, conferenceId)
      result.mergedParticipants += deduped.mergedParticipants
      result.deletedParticipants += deduped.deletedParticipants
      result.reparentedMediaStreams += deduped.reparentedMediaStreams
      result.reparentedQualityWindows += deduped.reparentedQualityWindows
    }
  })

  return result
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const key = getKey(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  return groups
}

function getConferenceDuplicateKey(conference: CleanupConference): string {
  if (conference.historyId) return `history:${conference.historyId}`
  if (conference.callId) return `call:${conference.callId}`
  return [
    'window',
    conference.vmrId,
    conference.startTime.toISOString(),
    conference.endTime?.toISOString() ?? 'null',
  ].join(':')
}

function chooseCanonicalConference(group: CleanupConference[]): CleanupConference {
  return [...group].sort((left, right) => {
    const leftScore = conferencePriorityScore(left)
    const rightScore = conferencePriorityScore(right)
    if (leftScore !== rightScore) return rightScore - leftScore
    if (left.participants.length !== right.participants.length) return right.participants.length - left.participants.length
    return left.id - right.id
  })[0]
}

function conferencePriorityScore(conference: CleanupConference): number {
  return (conference.historyId ? 4 : 0) + (conference.callId ? 2 : 0) + (conference.endTime ? 1 : 0)
}

function buildConferenceUpdate(canonical: CleanupConference, group: CleanupConference[]): Prisma.ConferenceUpdateInput {
  const update: Prisma.ConferenceUpdateInput = {}
  const historyId = canonical.historyId ?? group.find((conference) => conference.historyId)?.historyId ?? null
  const callId = canonical.callId ?? group.find((conference) => conference.callId)?.callId ?? null
  const endTime = canonical.endTime ?? group.find((conference) => conference.endTime)?.endTime ?? null

  if (historyId && historyId !== canonical.historyId) update.historyId = historyId
  if (callId && callId !== canonical.callId) update.callId = callId
  if (endTime && (!canonical.endTime || canonical.endTime.getTime() !== endTime.getTime())) update.endTime = endTime

  return update
}

async function mergeParticipantIntoConference(
  tx: Prisma.TransactionClient,
  conferenceId: number,
  participant: CleanupParticipant,
): Promise<{ merged: boolean; moved: boolean }> {
  const matchingParticipant = await tx.participant.findFirst({
    where: buildParticipantDuplicateWhere(conferenceId, participant),
    select: {
      id: true,
      conferenceId: true,
      name: true,
      identity: true,
      sourceAlias: true,
      destinationAlias: true,
      remoteAddress: true,
      joinTime: true,
      leaveTime: true,
      duration: true,
      protocol: true,
      role: true,
      callDirection: true,
      vendor: true,
      encryption: true,
      disconnectReason: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  if (!matchingParticipant) {
    if (participant.conferenceId !== conferenceId) {
      await tx.participant.update({
        where: { id: participant.id },
        data: { conferenceId },
      })
      return { merged: false, moved: true }
    }

    return { merged: false, moved: false }
  }

  if (matchingParticipant.id === participant.id) {
    return { merged: false, moved: false }
  }

  await mergeParticipantRows(tx, matchingParticipant.id, participant, matchingParticipant)
  return { merged: true, moved: false }
}

async function dedupeParticipantsWithinConference(
  tx: Prisma.TransactionClient,
  conferenceId: number,
): Promise<Pick<HistoryCleanupResult, 'mergedParticipants' | 'deletedParticipants' | 'reparentedMediaStreams' | 'reparentedQualityWindows'>> {
  const participants = await tx.participant.findMany({
    where: { conferenceId },
    select: {
      id: true,
      conferenceId: true,
      name: true,
      identity: true,
      sourceAlias: true,
      destinationAlias: true,
      remoteAddress: true,
      callUuid: true,
      joinTime: true,
      leaveTime: true,
      duration: true,
      protocol: true,
      role: true,
      callDirection: true,
      vendor: true,
      encryption: true,
      disconnectReason: true,
      createdAt: true,
      mediaStreams: { select: { id: true } },
      qualityWindows: { select: { id: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const result = {
    mergedParticipants: 0,
    deletedParticipants: 0,
    reparentedMediaStreams: 0,
    reparentedQualityWindows: 0,
  }

  for (const group of Array.from(groupBy(participants, getParticipantDuplicateKey).values()).filter((entries) => entries.length > 1)) {
    const canonicalParticipant = chooseCanonicalParticipant(group)

    for (const duplicateParticipant of group) {
      if (duplicateParticipant.id === canonicalParticipant.id) continue

      await mergeParticipantRows(tx, canonicalParticipant.id, duplicateParticipant, canonicalParticipant)
      result.mergedParticipants += 1
      result.deletedParticipants += 1
      result.reparentedMediaStreams += duplicateParticipant.mediaStreams.length
      result.reparentedQualityWindows += duplicateParticipant.qualityWindows.length
    }
  }

  return result
}

function chooseCanonicalParticipant(group: CleanupParticipant[]): CleanupParticipant {
  return [...group].sort((left, right) => {
    const leftScore = participantPriorityScore(left)
    const rightScore = participantPriorityScore(right)
    if (leftScore !== rightScore) return rightScore - leftScore
    return left.id - right.id
  })[0]
}

function participantPriorityScore(participant: CleanupParticipant): number {
  return [
    participant.callUuid,
    participant.identity,
    participant.sourceAlias,
    participant.destinationAlias,
    participant.remoteAddress,
    participant.leaveTime?.toISOString() ?? null,
    participant.protocol,
    participant.vendor,
    participant.encryption,
    participant.disconnectReason,
  ].filter(Boolean).length
}

function getParticipantDuplicateKey(participant: CleanupParticipant): string {
  if (participant.callUuid) return `uuid:${participant.callUuid}`

  return [
    'fallback',
    participant.name ?? '',
    participant.identity ?? '',
    participant.sourceAlias ?? '',
    participant.destinationAlias ?? '',
    participant.remoteAddress ?? '',
    participant.joinTime.toISOString(),
    participant.leaveTime?.toISOString() ?? 'null',
  ].join(':')
}

function buildParticipantDuplicateWhere(conferenceId: number, participant: CleanupParticipant): Prisma.ParticipantWhereInput {
  if (participant.callUuid) {
    return {
      conferenceId,
      callUuid: participant.callUuid,
    }
  }

  return {
    conferenceId,
    callUuid: null,
    name: participant.name,
    identity: participant.identity,
    sourceAlias: participant.sourceAlias,
    destinationAlias: participant.destinationAlias,
    remoteAddress: participant.remoteAddress,
    joinTime: participant.joinTime,
    leaveTime: participant.leaveTime,
  }
}

async function mergeParticipantRows(
  tx: Prisma.TransactionClient,
  canonicalParticipantId: number,
  duplicateParticipant: CleanupParticipant,
  existingParticipant: {
    id: number
    conferenceId: number
    name: string | null
    identity: string | null
    sourceAlias: string | null
    destinationAlias: string | null
    remoteAddress: string | null
    joinTime: Date
    leaveTime: Date | null
    duration: number | null
    protocol: string | null
    role: string | null
    callDirection: string | null
    vendor: string | null
    encryption: string | null
    disconnectReason: string | null
    createdAt: Date
  },
) {
  const update = buildParticipantUpdate(existingParticipant, duplicateParticipant)
  if (Object.keys(update).length > 0) {
    await tx.participant.update({
      where: { id: canonicalParticipantId },
      data: update,
    })
  }

  if (duplicateParticipant.mediaStreams.length > 0) {
    await tx.mediaStream.updateMany({
      where: { participantId: duplicateParticipant.id },
      data: { participantId: canonicalParticipantId },
    })
  }

  if (duplicateParticipant.qualityWindows.length > 0) {
    await tx.qualityWindow.updateMany({
      where: { participantId: duplicateParticipant.id },
      data: { participantId: canonicalParticipantId },
    })
  }

  await tx.participant.delete({ where: { id: duplicateParticipant.id } })
}

function buildParticipantUpdate(
  canonical: {
    name: string | null
    identity: string | null
    sourceAlias: string | null
    destinationAlias: string | null
    remoteAddress: string | null
    joinTime: Date
    leaveTime: Date | null
    duration: number | null
    protocol: string | null
    role: string | null
    callDirection: string | null
    vendor: string | null
    encryption: string | null
    disconnectReason: string | null
  },
  duplicate: CleanupParticipant,
): Prisma.ParticipantUpdateInput {
  const update: Prisma.ParticipantUpdateInput = {}

  if (!canonical.name && duplicate.name) update.name = duplicate.name
  if (!canonical.identity && duplicate.identity) update.identity = duplicate.identity
  if (!canonical.sourceAlias && duplicate.sourceAlias) update.sourceAlias = duplicate.sourceAlias
  if (!canonical.destinationAlias && duplicate.destinationAlias) update.destinationAlias = duplicate.destinationAlias
  if (!canonical.remoteAddress && duplicate.remoteAddress) update.remoteAddress = duplicate.remoteAddress
  if (!canonical.leaveTime && duplicate.leaveTime) update.leaveTime = duplicate.leaveTime
  if ((canonical.duration ?? 0) < (duplicate.duration ?? 0)) update.duration = duplicate.duration
  if (!canonical.protocol && duplicate.protocol) update.protocol = duplicate.protocol
  if (!canonical.role && duplicate.role) update.role = duplicate.role
  if (!canonical.callDirection && duplicate.callDirection) update.callDirection = duplicate.callDirection
  if (!canonical.vendor && duplicate.vendor) update.vendor = duplicate.vendor
  if (!canonical.encryption && duplicate.encryption) update.encryption = duplicate.encryption
  if (!canonical.disconnectReason && duplicate.disconnectReason) update.disconnectReason = duplicate.disconnectReason

  return update
}
