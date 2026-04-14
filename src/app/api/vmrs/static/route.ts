import { NextRequest, NextResponse } from 'next/server'
import * as https from 'https'

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

function fetchWithBasicAuth(
  url: string,
  username: string,
  password: string
): Promise<Response> {
  const credentials = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString()
        resolve(fetchWithBasicAuth(redirectUrl, username, password))
        return
      }

      const chunks: Buffer[] = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks)
        const textStr = bodyBuffer.toString('utf8')
        const isOk = res.statusCode! >= 200 && res.statusCode! < 300

        resolve({
          ok: isOk,
          status: res.statusCode!,
          statusText: res.statusMessage || '',
          url,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          headers: new Headers(res.headers as any),
          text: async () => textStr,
          json: async () => JSON.parse(textStr)
        } as unknown as Response)
      })
    })
    req.on('error', reject)
    req.end()
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { baseUrl: string; username: string; password: string; search?: string }
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

    const apiUrl = new URL('/api/admin/configuration/v1/conference/', parsedUrl.origin)
    if (search) {
      apiUrl.searchParams.set('name__icontains', search)
    }

    const vmrs: PexipConference[] = []
    let nextUrl: string | null = apiUrl.toString()
    const baseOrigin = parsedUrl.origin

    while (nextUrl) {
      let response: Response
      try {
        response = await fetchWithBasicAuth(nextUrl, username, password)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `Could not reach Management Node: ${message}` }, { status: 502 })
      }

      if (!response.ok) {
        return NextResponse.json(
          { error: `Pexip API returned ${response.status}` },
          { status: 502 }
        )
      }

      const data = await response.json() as {
        meta?: { next?: string | null; total_count?: number }
        objects?: PexipConference[]
      }

      if (data.objects) {
        vmrs.push(...data.objects)
      }

      const nextPath = data.meta?.next
      if (nextPath) {
        const parsedNext = new URL(nextPath, baseOrigin)
        const enforcedNext = new URL(parsedNext.pathname + parsedNext.search, baseOrigin)
        nextUrl = enforcedNext.toString()
      } else {
        nextUrl = null
      }
    }

    return NextResponse.json({
      vmrs: vmrs.map(v => ({
        id: v.id,
        name: v.name,
        description: v.description ?? '',
        aliases: v.aliases ?? [],
        allow_guests: v.allow_guests ?? false,
        tag: v.tag ?? null,
        service_type: v.service_type ?? null,
      })),
      total: vmrs.length
    })
  } catch (error) {
    console.error('Static VMRs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
