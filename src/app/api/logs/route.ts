import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  const source = searchParams.get('source')
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const pageSize = 50

  const where: Record<string, string> = {}
  if (level) where.level = level
  if (source) where.source = source

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.log.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, pageSize })
}

export async function DELETE() {
  await prisma.log.deleteMany()
  return NextResponse.json({ status: 'ok' })
}
