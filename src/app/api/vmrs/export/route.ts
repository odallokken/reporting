import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays, format } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'
import { fetchStaticVmrNames } from '@/lib/pexip'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fmt = searchParams.get('format') ?? 'csv'
    const staleThreshold = subDays(new Date(), 30)
    const excludedIds = await getShortConferenceIds()
    const confFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    // Read Pexip credentials from query params or headers to exclude static VMRs
    const baseUrl = searchParams.get('baseUrl') ?? ''
    const username = searchParams.get('username') ?? ''
    const password = searchParams.get('password') ?? ''

    const staticVmrNames = await fetchStaticVmrNames(baseUrl, username, password)

    const conditions: Record<string, unknown>[] = []
    if (staticVmrNames.length > 0) {
      conditions.push({ name: { notIn: staticVmrNames } })
    }
    conditions.push({ conferences: { some: { ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}), participants: { some: {} } } } })
    const where = { AND: conditions }

    const vmrs = await prisma.vMR.findMany({
      where,
      orderBy: { lastUsedAt: 'desc' },
      include: {
        conferences: {
          where: confFilter,
          select: { _count: { select: { participants: true } } }
        }
      }
    })

    const data = vmrs.map(vmr => ({
      id: vmr.id,
      name: vmr.name,
      lastUsedAt: vmr.lastUsedAt ? format(new Date(vmr.lastUsedAt), 'yyyy-MM-dd HH:mm:ss') : '',
      createdAt: format(new Date(vmr.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      totalCalls: vmr.conferences.length,
      totalParticipants: vmr.conferences.reduce((sum, c) => sum + c._count.participants, 0),
      isStale: !vmr.lastUsedAt || vmr.lastUsedAt < staleThreshold ? 'Yes' : 'No'
    }))

    if (fmt === 'json') {
      return NextResponse.json(data)
    }

    const headers = ['ID', 'Name', 'Last Used', 'Created', 'Total Calls', 'Total Participants', 'Stale']
    const rows = data.map(r => [r.id, `"${r.name}"`, r.lastUsedAt, r.createdAt, r.totalCalls, r.totalParticipants, r.isStale].join(','))
    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="vmrs.csv"'
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
