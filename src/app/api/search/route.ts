export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], total: 0, page, limit })
    }

    const skip = (page - 1) * limit

    const where = {
      OR: [
        { name: { contains: query } },
        { identity: { contains: query } },
        { sourceAlias: { contains: query } },
        { destinationAlias: { contains: query } },
        { callUuid: { contains: query } },
        { remoteAddress: { contains: query } },
        { vendor: { contains: query } },
      ],
    }

    const [results, total] = await Promise.all([
      prisma.participant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { joinTime: 'desc' },
        include: {
          conference: {
            include: { vmr: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.participant.count({ where }),
    ])

    const formattedResults = results.map((p) => ({
      id: p.id,
      name: p.name,
      identity: p.identity,
      sourceAlias: p.sourceAlias,
      destinationAlias: p.destinationAlias,
      callUuid: p.callUuid,
      remoteAddress: p.remoteAddress,
      protocol: p.protocol,
      vendor: p.vendor,
      callDirection: p.callDirection,
      encryption: p.encryption,
      callQuality: p.callQuality,
      disconnectReason: p.disconnectReason,
      duration: p.duration,
      joinTime: p.joinTime.toISOString(),
      leaveTime: p.leaveTime?.toISOString() ?? null,
      role: p.role,
      vmrName: p.conference.vmr.name,
      vmrId: p.conference.vmr.id,
      conferenceId: p.conferenceId,
    }))

    return NextResponse.json({
      results: formattedResults,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
