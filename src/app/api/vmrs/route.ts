import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const sortBy = searchParams.get('sortBy') ?? 'lastUsedAt'
    const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'
    const staleDays = parseInt(searchParams.get('staleDays') ?? '30')

    const skip = (page - 1) * limit
    const staleThreshold = subDays(new Date(), staleDays)
    const excludedIds = await getShortConferenceIds()
    const confFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    const where = search ? { name: { contains: search } } : {}

    const [vmrs, total] = await Promise.all([
      prisma.vMR.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy === 'name' ? { name: sortOrder } : { lastUsedAt: sortOrder },
        include: {
          conferences: {
            where: confFilter,
            select: {
              _count: { select: { participants: true } }
            }
          }
        }
      }),
      prisma.vMR.count({ where })
    ])

    const vmrsWithStats = vmrs.map(vmr => ({
      id: vmr.id,
      name: vmr.name,
      lastUsedAt: vmr.lastUsedAt?.toISOString() ?? null,
      createdAt: vmr.createdAt.toISOString(),
      totalCalls: vmr.conferences.length,
      totalParticipants: vmr.conferences.reduce((sum, c) => sum + c._count.participants, 0),
      isStale: !vmr.lastUsedAt || vmr.lastUsedAt < staleThreshold
    }))

    return NextResponse.json({ vmrs: vmrsWithStats, total, page, limit })
  } catch (error) {
    console.error('VMRs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
