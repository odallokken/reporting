export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { fetchReportData } from '@/lib/reports/data'
import { ExecReportDocument } from '@/lib/reports/pdf-document'

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? fallback : d
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const now = new Date()
    const defaultEnd = new Date(now)
    const defaultStart = new Date(now)
    defaultStart.setDate(defaultStart.getDate() - 29)

    const startDate = parseDate(url.searchParams.get('start'), defaultStart)
    const endDate = parseDate(url.searchParams.get('end'), defaultEnd)

    if (startDate > endDate) {
      return NextResponse.json({ error: 'start must be before end' }, { status: 400 })
    }

    const data = await fetchReportData(startDate, endDate)

    const pdfBuffer = await renderToBuffer(
      createElement(ExecReportDocument, { data }) as ReactElement<DocumentProps>
    )

    const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '')
    const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `executive-report-${startStr}-${endStr}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
