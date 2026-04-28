import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { runCdrImport } from '@/lib/cdr-import'

const LOG_SOURCE = 'cdr-import'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      baseUrl: string
      username: string
      password: string
      minDurationSeconds?: number
    }

    const outcome = await runCdrImport({
      baseUrl: body.baseUrl,
      username: body.username,
      password: body.password,
      minDurationSeconds: body.minDurationSeconds,
      logSource: LOG_SOURCE,
    })

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error.error }, { status: outcome.error.status })
    }

    return NextResponse.json(outcome.result)
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    await log('error', 'CDR import failed with unexpected error', { source: LOG_SOURCE, details: errMessage })
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
