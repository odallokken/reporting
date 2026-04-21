import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { log } from '@/lib/logger'
import { cleanupHistoricalDuplicates } from '@/lib/history-cleanup'

const LOG_SOURCE = 'history-cleanup'

export async function POST() {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await log('info', 'Starting historical duplicate cleanup', { source: LOG_SOURCE })
    const result = await cleanupHistoricalDuplicates()
    await log('info', 'Historical duplicate cleanup complete', {
      source: LOG_SOURCE,
      details: JSON.stringify(result),
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log('error', 'Historical duplicate cleanup failed', {
      source: LOG_SOURCE,
      details: message,
    })
    return NextResponse.json({ error: `Cleanup failed: ${message}` }, { status: 500 })
  }
}
