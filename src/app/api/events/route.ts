import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PexipEvent, PexipEventData } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PexipEvent

    if (body.event === 'eventsink_bulk' && Array.isArray(body.data)) {
      for (const evt of body.data) {
        processSingleEvent(evt).catch(err => console.error('Failed to process Pexip bulk event:', err))
      }
    } else {
      processSingleEvent(body).catch(err => console.error('Failed to process Pexip event:', err))
    }

    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

async function processSingleEvent(body: PexipEvent) {
  const { event, time } = body
  const data = body.data as PexipEventData
  const timestamp = new Date(time * 1000)

  // For conference events, the conference name is in data.name
  // For participant events, the conference name is in data.conference
  const conferenceName = data.conference ?? data.name
  if (!conferenceName) return

  const vmr = await prisma.vMR.upsert({
    where: { name: conferenceName },
    update: { lastUsedAt: timestamp },
    create: { name: conferenceName, lastUsedAt: timestamp }
  })

  const callId = data.call_id ?? null

  if (event === 'conference_started') {
    try {
      await prisma.conference.create({
        data: { vmrId: vmr.id, startTime: timestamp, callId }
      })
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
        console.error('Unexpected error creating conference:', err)
      }
    }
  } else if (event === 'conference_ended') {
    if (callId) {
      await prisma.conference.updateMany({
        where: { callId },
        data: { endTime: timestamp }
      })
    }
  } else if (event === 'participant_connected') {
    let conf = callId ? await prisma.conference.findUnique({ where: { callId } }) : null
    if (!conf) {
      try {
        conf = await prisma.conference.create({
          data: { vmrId: vmr.id, startTime: timestamp, callId }
        })
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
          console.error('Unexpected error creating conference for participant:', err)
        }
        if (callId) {
          conf = await prisma.conference.findUnique({ where: { callId } })
        }
      }
    }
    const callUuid = data.uuid ?? null
    if (conf && callUuid) {
      await prisma.participant.upsert({
        where: { callUuid },
        update: { joinTime: timestamp },
        create: {
          conferenceId: conf.id,
          name: data.display_name ?? null,
          identity: data.source_alias ?? null,
          callUuid,
          joinTime: timestamp,
          protocol: data.protocol ?? null,
          role: data.role ?? null,
          sourceAlias: data.source_alias ?? null,
          destinationAlias: data.destination_alias ?? null,
          callDirection: data.call_direction ?? null,
          remoteAddress: data.remote_address ?? null,
          vendor: data.vendor ?? null,
        }
      })
    }
  } else if (event === 'participant_disconnected') {
    const callUuid = data.uuid ?? null
    if (callUuid) {
      await prisma.participant.updateMany({
        where: { callUuid },
        data: { leaveTime: timestamp }
      })
    }
  }
}
