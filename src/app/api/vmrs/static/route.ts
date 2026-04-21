import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchStaticVmrConfigurations } from '@/lib/pexip'

interface PexipConference {
  id: number
  name: string
  description: string
  aliases: { alias: string }[]
  pin: string | null
  guest_pin: string | null
  allow_guests: boolean
  tag: string | null
  service_type: string | null
  resource_uri: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { baseUrl: string; username: string; password: string; search?: string; countOnly?: boolean }
    const baseUrl = body.baseUrl?.trim()
    const username = body.username?.trim()
    const password = body.password ?? ''
    const search = body.search?.trim() ?? ''
    const countOnly = body.countOnly === true

    if (!baseUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing credentials. Please configure them in Settings.' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(baseUrl)
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('URL must use HTTPS')
      }
    } catch {
      return NextResponse.json({ error: 'Invalid Management Node URL' }, { status: 400 })
    }

    const { objects: allVmrs, error: fetchError } = await fetchStaticVmrConfigurations<PexipConference>(
      parsedUrl.origin,
      username,
      password,
      search,
    )

    if (fetchError) {
      return NextResponse.json({ error: fetchError }, { status: 502 })
    }

    if (countOnly) {
      return NextResponse.json({ total: allVmrs.length })
    }

    // Cross-reference with local database to get lastUsedAt and totalConferences
    const vmrNames = allVmrs.map(v => v.name)
    const localVmrs = await prisma.vMR.findMany({
      where: { name: { in: vmrNames } },
      select: {
        name: true,
        _count: {
          select: {
            conferences: {
              where: { participants: { some: {} } }
            }
          }
        },
        conferences: {
          where: { participants: { some: {} } },
          select: { startTime: true },
          orderBy: { startTime: 'desc' },
          take: 1,
        }
      }
    })
    const localMap = new Map(localVmrs.map(v => [v.name, v]))

    return NextResponse.json({
      vmrs: allVmrs.map(v => {
        const local = localMap.get(v.name)
        return {
          id: v.id,
          name: v.name,
          description: v.description ?? '',
          aliases: v.aliases ?? [],
          allow_guests: v.allow_guests ?? false,
          tag: v.tag ?? null,
          service_type: v.service_type ?? null,
          lastUsedAt: local?.conferences[0]?.startTime?.toISOString() ?? null,
          totalConferences: local?._count.conferences ?? 0,
        }
      }),
      total: allVmrs.length
    })
  } catch (error) {
    console.error('Static VMRs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
