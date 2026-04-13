import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface PexipCDRConference {
  id?: number
  name?: string
  start_time?: string
  end_time?: string
  call_id?: string
  participants?: PexipCDRParticipant[]
}

interface PexipCDRParticipant {
  display_name?: string
  call_uuid?: string
  connect_time?: string
  disconnect_time?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { baseUrl: string; username: string; password: string }
    const { baseUrl, username, password } = body

    if (!baseUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/admin/history/v1/conference/`
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')

    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` }
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Pexip API returned ${response.status}` }, { status: 502 })
    }

    const apiData = await response.json() as { objects?: PexipCDRConference[] }
    const conferences: PexipCDRConference[] = apiData.objects ?? []

    let imported = 0
    let skipped = 0

    for (const conf of conferences) {
      try {
        const vmrName = conf.name ?? 'Unknown'
        const startTime = conf.start_time ? new Date(conf.start_time) : null
        const vmr = await prisma.vMR.upsert({
          where: { name: vmrName },
          update: startTime ? { lastUsedAt: startTime } : {},
          create: { name: vmrName, lastUsedAt: startTime }
        })

        const conference = await prisma.conference.create({
          data: {
            vmrId: vmr.id,
            startTime: conf.start_time ? new Date(conf.start_time) : new Date(),
            endTime: conf.end_time ? new Date(conf.end_time) : null,
            callId: conf.call_id ?? null
          }
        })

        if (conf.participants) {
          for (const p of conf.participants) {
            await prisma.participant.create({
              data: {
                conferenceId: conference.id,
                name: p.display_name ?? null,
                callUuid: p.call_uuid ?? null,
                joinTime: p.connect_time ? new Date(p.connect_time) : new Date(),
                leaveTime: p.disconnect_time ? new Date(p.disconnect_time) : null
              }
            })
          }
        }
        imported++
      } catch (err) {
        console.error('Failed to import conference:', conf.call_id ?? conf.name, err)
        skipped++
      }
    }

    return NextResponse.json({ imported, skipped, total: conferences.length })
  } catch (error) {
    console.error('CDR import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
