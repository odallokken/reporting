import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/logger'
import { runCdrImport } from '@/lib/cdr-import'

const LOG_SOURCE = 'cdr-clean-import'

/**
 * Token the client must include in the request body to confirm the
 * destructive action. This is enforced server-side so a stale or buggy
 * client cannot trigger the wipe by accident.
 */
const REQUIRED_CONFIRM_TOKEN = 'DELETE_ALL_CDRS'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    baseUrl?: string
    username?: string
    password?: string
    minDurationSeconds?: number
    confirm?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.confirm !== REQUIRED_CONFIRM_TOKEN) {
    return NextResponse.json(
      { error: `Missing or invalid confirmation token. Expected confirm: "${REQUIRED_CONFIRM_TOKEN}".` },
      { status: 400 },
    )
  }

  if (!body.baseUrl || !body.username || !body.password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let deleted: {
    qualityWindows: number
    mediaStreams: number
    participants: number
    conferences: number
  }

  try {
    await log('info', 'Starting clean CDR import: deleting existing CDR data', { source: LOG_SOURCE })

    // Delete in dependency order to satisfy foreign key constraints.
    // Wrapped in a single transaction so a partial failure does not leave
    // the database in an inconsistent half-wiped state.
    deleted = await prisma.$transaction(async (tx) => {
      const qualityWindows = await tx.qualityWindow.deleteMany({})
      const mediaStreams = await tx.mediaStream.deleteMany({})
      const participants = await tx.participant.deleteMany({})
      const conferences = await tx.conference.deleteMany({})
      return {
        qualityWindows: qualityWindows.count,
        mediaStreams: mediaStreams.count,
        participants: participants.count,
        conferences: conferences.count,
      }
    })

    await log('info', 'CDR data wiped, starting fresh import', {
      source: LOG_SOURCE,
      details: JSON.stringify(deleted),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log('error', 'Clean import: failed to wipe existing CDR data', {
      source: LOG_SOURCE,
      details: message,
    })
    return NextResponse.json({ error: `Failed to delete existing data: ${message}` }, { status: 500 })
  }

  // Run the import using the shared helper. We deliberately do NOT wrap the
  // import in the delete transaction — the import makes external HTTP calls
  // and can take a long time, which would hold a database transaction open
  // for the entire duration.
  const outcome = await runCdrImport({
    baseUrl: body.baseUrl,
    username: body.username,
    password: body.password,
    minDurationSeconds: body.minDurationSeconds,
    logSource: LOG_SOURCE,
  })

  if (!outcome.ok) {
    await log('error', 'Clean import: fresh import step failed after wipe', {
      source: LOG_SOURCE,
      details: outcome.error.error,
    })
    return NextResponse.json(
      { error: outcome.error.error, deleted },
      { status: outcome.error.status },
    )
  }

  await log('info', 'Clean CDR import complete', {
    source: LOG_SOURCE,
    details: `deleted=${JSON.stringify(deleted)} imported=${outcome.result.imported} skipped=${outcome.result.skipped}`,
  })

  return NextResponse.json({
    deleted,
    imported: outcome.result.imported,
    skipped: outcome.result.skipped,
    total: outcome.result.total,
  })
}
