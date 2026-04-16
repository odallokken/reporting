import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchWithBasicAuth, fetchAllPexipPages } from '@/lib/pexip'

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

    const apiUrl = new URL('/api/admin/configuration/v1/conference/', parsedUrl.origin)
    if (search) {
      apiUrl.searchParams.set('name__icontains', search)
    }

    if (countOnly) {
      apiUrl.searchParams.set('limit', '0')
      let response: Response
      try {
        response = await fetchWithBasicAuth(apiUrl.toString(), username, password)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `Could not reach Management Node: ${message}` }, { status: 502 })
      }
      if (!response.ok) {
        return NextResponse.json({ error: `Pexip API returned ${response.status}` }, { status: 502 })
      }
      const data = await response.json() as { meta?: { total_count?: number } }
      return NextResponse.json({ total: data.meta?.total_count ?? 0 })
    }

    const { objects: vmrs, error: fetchError } = await fetchAllPexipPages<PexipConference>(
      apiUrl.toString(),
      parsedUrl.origin,
      username,
      password
    )

    if (fetchError) {
      return NextResponse.json({ error: fetchError }, { status: 502 })
    }

    // Cross-reference with local database to get lastUsedAt and totalConferences
    const vmrNames = vmrs.map(v => v.name)
    const localVmrs = await prisma.vMR.findMany({
      where: { name: { in: vmrNames } },
      select: {
        name: true,
        _count: { select: { conferences: true } },
        conferences: {
          select: { startTime: true },
          orderBy: { startTime: 'desc' },
          take: 1,
        }
      }
    })
    const localMap = new Map(localVmrs.map(v => [v.name, v]))

    return NextResponse.json({
      vmrs: vmrs.map(v => {
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
      total: vmrs.length
    })
  } catch (error) {
    console.error('Static VMRs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
