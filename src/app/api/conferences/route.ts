import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vmrId = searchParams.get('vmrId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')

    const where: Record<string, unknown> = {}
    if (vmrId) where.vmrId = parseInt(vmrId)
    if (from || to) {
      where.startTime = {}
      if (from) (where.startTime as Record<string, Date>).gte = new Date(from)
      if (to) (where.startTime as Record<string, Date>).lte = new Date(to)
    }

    const [conferences, total] = await Promise.all([
      prisma.conference.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: {
          vmr: true,
          _count: { select: { participants: true } }
        }
      }),
      prisma.conference.count({ where })
    ])

    return NextResponse.json({
      conferences: conferences.map(c => ({
        id: c.id,
        vmrId: c.vmrId,
        vmrName: c.vmr.name,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime?.toISOString() ?? null,
        callId: c.callId,
        participantCount: c._count.participants,
        createdAt: c.createdAt.toISOString()
      })),
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Conferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
