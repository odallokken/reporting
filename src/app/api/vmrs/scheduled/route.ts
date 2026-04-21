import { NextRequest, NextResponse } from 'next/server'
import { fetchAllPexipPages } from '@/lib/pexip'

interface PexipScheduledConference {
  id: number
  name: string
  description: string
  creation_time: string
  start_time: string
  end_time: string
  is_active: boolean
  aliases: string[]
  conference: string
  resource_uri: string
  tag: string | null
}

interface PexipScheduledAlias {
  id: number
  alias: string
  scheduled_conference: string
  description: string
  resource_uri: string
}

interface PexipConferenceVMR {
  name: string
  description: string
  aliases: { alias: string }[]
  resource_uri: string
  primary_owner_email_address: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      baseUrl: string
      username: string
      password: string
      search?: string
    }
    const baseUrl = body.baseUrl?.trim()
    const username = body.username?.trim()
    const password = body.password ?? ''
    const search = body.search?.trim() ?? ''

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

    // Fetch scheduled conferences, aliases, and linked VMR conferences in parallel
    const confUrl = new URL('/api/admin/configuration/v1/scheduled_conference/', parsedUrl.origin)
    const aliasUrl = new URL('/api/admin/configuration/v1/scheduled_alias/', parsedUrl.origin)
    const vmrUrl = new URL('/api/admin/configuration/v1/conference/', parsedUrl.origin)
    vmrUrl.searchParams.set('service_type', 'conference')

    const [confResult, aliasResult, vmrResult] = await Promise.all([
      fetchAllPexipPages<PexipScheduledConference>(
        confUrl.toString(),
        parsedUrl.origin,
        username,
        password
      ),
      fetchAllPexipPages<PexipScheduledAlias>(
        aliasUrl.toString(),
        parsedUrl.origin,
        username,
        password
      ),
      fetchAllPexipPages<PexipConferenceVMR>(
        vmrUrl.toString(),
        parsedUrl.origin,
        username,
        password
      )
    ])

    if (confResult.error) {
      return NextResponse.json({ error: confResult.error }, { status: 502 })
    }

    // Build a map of scheduled conference resource_uri -> aliases
    const aliasMap = new Map<string, string[]>()
    if (!aliasResult.error) {
      for (const alias of aliasResult.objects) {
        const confUri = alias.scheduled_conference
        const existing = aliasMap.get(confUri) ?? []
        existing.push(alias.alias)
        aliasMap.set(confUri, existing)
      }
    }

    // Build a map of conference resource_uri -> VMR data (name, aliases, organizer)
    const vmrMap = new Map<string, PexipConferenceVMR>()
    if (!vmrResult.error) {
      for (const vmr of vmrResult.objects) {
        vmrMap.set(vmr.resource_uri, vmr)
      }
    }

    // Merge data from linked conferences and scheduled aliases, then apply search filter
    const conferences = confResult.objects
      .map(conf => {
        const linkedVmr = conf.conference ? vmrMap.get(conf.conference) : undefined
        const scheduledAliases = aliasMap.get(conf.resource_uri) ?? []
        const vmrAliases = linkedVmr?.aliases?.map(a => a.alias) ?? []
        const aliases = [...new Set([...scheduledAliases, ...vmrAliases])]
        return {
          id: conf.id,
          name: (conf.name || linkedVmr?.name) ?? '',
          description: conf.description ?? '',
          start_time: conf.start_time ?? null,
          end_time: conf.end_time ?? null,
          is_active: conf.is_active ?? false,
          tag: conf.tag ?? null,
          aliases,
          organizer: linkedVmr?.primary_owner_email_address ?? null,
        }
      })
      .filter(conf => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          (conf.name ?? '').toLowerCase().includes(s) ||
          conf.description.toLowerCase().includes(s) ||
          conf.aliases.some(a => a.toLowerCase().includes(s)) ||
          (conf.organizer ?? '').toLowerCase().includes(s)
        )
      })

    return NextResponse.json({
      conferences,
      total: conferences.length
    })
  } catch (error) {
    console.error('Scheduled VMRs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
