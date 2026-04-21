import * as https from 'https'

/**
 * Make an HTTPS GET request with HTTP Basic Auth.
 * Follows redirects automatically.
 */
export function fetchWithBasicAuth(
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
        const headerEntries: [string, string][] = []
        for (const [key, val] of Object.entries(res.headers)) {
          if (val !== undefined) {
            headerEntries.push([key, Array.isArray(val) ? val.join(', ') : val])
          }
        }

        resolve({
          ok: isOk,
          status: res.statusCode!,
          statusText: res.statusMessage || '',
          url,
          headers: new Headers(headerEntries),
          text: async () => textStr,
          json: async () => JSON.parse(textStr)
        } as unknown as Response)
      })
    })
    req.on('error', reject)
    req.end()
  })
}

export interface PexipPaginatedResponse<T> {
  meta?: { next?: string | null; total_count?: number }
  objects?: T[]
}

interface PexipConferenceConfiguration {
  name: string
  resource_uri: string
}

interface PexipScheduledConferenceConfiguration {
  conference: string | null
}

/**
 * Fetch all pages from a paginated Pexip Management API endpoint.
 */
export async function fetchAllPexipPages<T>(
  initialUrl: string,
  baseOrigin: string,
  username: string,
  password: string
): Promise<{ objects: T[]; error?: string }> {
  const results: T[] = []
  let nextUrl: string | null = initialUrl

  while (nextUrl) {
    let response: Response
    try {
      response = await fetchWithBasicAuth(nextUrl, username, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { objects: [], error: `Could not reach Management Node: ${message}` }
    }

    if (!response.ok) {
      return { objects: [], error: `Pexip API returned ${response.status}` }
    }

    const data = await response.json() as PexipPaginatedResponse<T>

    if (data.objects) {
      results.push(...data.objects)
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

  return { objects: results }
}

/**
 * Fetch all static VMR names from Pexip Management Node.
 * Returns an empty array if credentials are missing or request fails.
 */
export async function fetchStaticVmrNames(
  baseUrl: string,
  username: string,
  password: string
): Promise<string[]> {
  const { objects } = await fetchStaticVmrConfigurations(baseUrl, username, password)
  return objects.map(v => v.name)
}

export async function fetchStaticVmrConfigurations<T extends PexipConferenceConfiguration>(
  baseUrl: string,
  username: string,
  password: string,
  search?: string
): Promise<{ objects: T[]; error?: string }> {
  if (!baseUrl || !username || !password) return { objects: [] }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(baseUrl)
    if (parsedUrl.protocol !== 'https:') return { objects: [] }
  } catch {
    return { objects: [] }
  }

  const conferenceUrl = new URL('/api/admin/configuration/v1/conference/', parsedUrl.origin)
  conferenceUrl.searchParams.set('service_type', 'conference')
  if (search) {
    conferenceUrl.searchParams.set('name__icontains', search)
  }

  const scheduledConferenceUrl = new URL('/api/admin/configuration/v1/scheduled_conference/', parsedUrl.origin)

  const [conferenceResult, scheduledConferenceResult] = await Promise.all([
    fetchAllPexipPages<T>(conferenceUrl.toString(), parsedUrl.origin, username, password),
    fetchAllPexipPages<PexipScheduledConferenceConfiguration>(scheduledConferenceUrl.toString(), parsedUrl.origin, username, password),
  ])

  if (conferenceResult.error) {
    return conferenceResult
  }

  if (scheduledConferenceResult.error) {
    return { objects: [], error: scheduledConferenceResult.error }
  }

  const scheduledConferenceUris = new Set(
    scheduledConferenceResult.objects
      .map((scheduledConference) => scheduledConference.conference)
      .filter((conference): conference is string => Boolean(conference))
  )

  return {
    objects: conferenceResult.objects.filter((conference) => !scheduledConferenceUris.has(conference.resource_uri)),
  }
}
