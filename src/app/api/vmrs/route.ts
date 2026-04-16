import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import { getShortConferenceIds } from '@/lib/settings'
import { fetchStaticVmrNames } from '@/lib/pexip'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      search?: string
      page?: number
      limit?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      staleDays?: number
      baseUrl?: string
      username?: string
      password?: string
    }
    const search = body.search ?? ''
    const page = body.page ?? 1
    const limit = body.limit ?? 20
    const sortBy = body.sortBy ?? 'lastUsedAt'
    const sortOrder = body.sortOrder ?? 'desc'
    const staleDays = body.staleDays ?? 30

    const skip = (page - 1) * limit
    const staleThreshold = subDays(new Date(), staleDays)
    const excludedIds = await getShortConferenceIds()
    const confFilter = excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}

    // Fetch static VMR names from Pexip to exclude them from dynamic results
    const staticVmrNames = await fetchStaticVmrNames(
      body.baseUrl ?? '',
      body.username ?? '',
      body.password ?? ''
    )

    // Build where clause: exclude static VMR names and optionally filter by search
    const conditions = []
    if (staticVmrNames.length > 0) {
      conditions.push({ name: { notIn: staticVmrNames } })
    }
    if (search) {
      conditions.push({ name: { contains: search } })
    }
    const where = conditions.length > 0 ? { AND: conditions } : {}

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
