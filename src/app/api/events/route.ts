import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PexipEvent } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PexipEvent
    processEvent(body).catch(console.error)
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

async function processEvent(data: PexipEvent) {
  const { event, conference, participant_name, call_uuid, call_id, timestamp } = data

  const vmr = await prisma.vMR.upsert({
    where: { name: conference },
    update: { lastUsedAt: new Date(timestamp) },
    create: { name: conference, lastUsedAt: new Date(timestamp) }
  })

  if (event === 'conference_started') {
    try {
      await prisma.conference.create({
        data: { vmrId: vmr.id, startTime: new Date(timestamp), callId: call_id ?? null }
      })
    } catch {
      // Conference may already exist
    }
  } else if (event === 'conference_ended') {
    if (call_id) {
      await prisma.conference.updateMany({
        where: { callId: call_id },
        data: { endTime: new Date(timestamp) }
      })
    }
  } else if (event === 'participant_connected') {
    let conf = call_id ? await prisma.conference.findUnique({ where: { callId: call_id } }) : null
    if (!conf) {
      try {
        conf = await prisma.conference.create({
          data: { vmrId: vmr.id, startTime: new Date(timestamp), callId: call_id ?? null }
        })
      } catch {
        if (call_id) {
          conf = await prisma.conference.findUnique({ where: { callId: call_id } })
        }
      }
    }
    if (conf && call_uuid) {
      await prisma.participant.upsert({
        where: { callUuid: call_uuid },
        update: { joinTime: new Date(timestamp) },
        create: {
          conferenceId: conf.id,
          name: participant_name ?? null,
          callUuid: call_uuid,
          joinTime: new Date(timestamp)
        }
      })
    }
  } else if (event === 'participant_disconnected') {
    if (call_uuid) {
      await prisma.participant.updateMany({
        where: { callUuid: call_uuid },
        data: { leaveTime: new Date(timestamp) }
      })
    }
  }
}
