import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Rect,
  Line,
  G,
  StyleSheet,
} from '@react-pdf/renderer'
import type { ReportData, PeakConcurrencyPoint, TopVmr, TopParticipant, QualitySummary } from './data'

// ─── Brand colours (matching tailwind.config.ts) ─────────────────────────────
const BRAND = {
  primary: '#05c8aa',
  primaryDark: '#058171',
  primaryLight: '#effefb',
  accent: '#3b8eff',
  accentDark: '#1f6bf5',
  dark: '#0f1729',
  darkAlt: '#162032',
  darkCard: '#1a2538',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { backgroundColor: BRAND.white, fontFamily: 'Helvetica', paddingBottom: 56 },
  coverPage: { backgroundColor: BRAND.dark, paddingBottom: 0 },

  // Cover
  coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  coverContent: { flex: 1, justifyContent: 'center', padding: 60 },
  coverLogo: { flexDirection: 'row', alignItems: 'center', marginBottom: 60 },
  coverLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  coverLogoText: { color: BRAND.white, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  coverBrand: { color: BRAND.white, fontSize: 20, fontFamily: 'Helvetica-Bold', opacity: 0.9 },
  coverRule: { height: 3, backgroundColor: BRAND.primary, width: 72, marginBottom: 32, borderRadius: 2 },
  coverTitle: { color: BRAND.white, fontSize: 36, fontFamily: 'Helvetica-Bold', lineHeight: 1.25, marginBottom: 12 },
  coverSubtitle: { color: BRAND.primary, fontSize: 16, fontFamily: 'Helvetica', marginBottom: 40 },
  coverMetaRow: { flexDirection: 'row', gap: 32, marginBottom: 8 },
  coverMetaLabel: { color: BRAND.gray400, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  coverMetaValue: { color: BRAND.white, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  coverDivider: { height: 1, backgroundColor: '#ffffff22', marginVertical: 32 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  sectionHeaderBar: { width: 4, height: 22, backgroundColor: BRAND.primary, borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: BRAND.gray900 },

  // KPI tiles
  kpiGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  kpiTile: {
    flex: 1,
    backgroundColor: BRAND.gray50,
    borderRadius: 10,
    padding: 16,
    borderLeft: `3px solid ${BRAND.primary}`,
  },
  kpiLabel: { fontSize: 9, color: BRAND.gray500, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  kpiValue: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: BRAND.gray900, marginBottom: 4 },
  kpiSubtext: { fontSize: 9, color: BRAND.gray400 },

  // Section padding
  section: { paddingHorizontal: 40, paddingTop: 28 },
  sectionLast: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 16 },

  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.dark,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 1,
  },
  tableHeaderCell: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BRAND.gray100 },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 10, backgroundColor: BRAND.gray50, borderBottomWidth: 1, borderBottomColor: BRAND.gray100 },
  tableCell: { fontSize: 10, color: BRAND.gray700 },
  tableCellRight: { fontSize: 10, color: BRAND.gray700, textAlign: 'right' },
  tableCellMuted: { fontSize: 9, color: BRAND.gray400 },

  // Narrative
  narrativeBox: {
    backgroundColor: BRAND.primaryLight,
    borderRadius: 10,
    padding: 20,
    borderLeft: `4px solid ${BRAND.primary}`,
  },
  narrativeLabel: { fontSize: 9, color: BRAND.primaryDark, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
  narrativeText: { fontSize: 11, color: BRAND.gray700, lineHeight: 1.6 },

  // Quality bars
  qualityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qualityLabel: { fontSize: 10, color: BRAND.gray700, width: 64 },
  qualityBarBg: { flex: 1, height: 10, backgroundColor: BRAND.gray200, borderRadius: 5, marginHorizontal: 8, overflow: 'hidden' },
  qualityBarFill: { height: 10, borderRadius: 5 },
  qualityPct: { fontSize: 10, color: BRAND.gray500, width: 36, textAlign: 'right' },

  // KPI quality row
  qualityKpiRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  qualityKpiTile: { flex: 1, backgroundColor: BRAND.gray50, borderRadius: 8, padding: 12, alignItems: 'center' },
  qualityKpiValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BRAND.gray900, marginBottom: 2 },
  qualityKpiLabel: { fontSize: 9, color: BRAND.gray400, textAlign: 'center' },

  // Footer / page number
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: BRAND.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 8, color: BRAND.gray400 },
  footerTextRight: { fontSize: 8, color: BRAND.gray400, textAlign: 'right' },

  // Chart container
  chartContainer: { marginBottom: 8 },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function pct(value: number): string {
  return `${Math.round(value)}%`
}

// ─── Peak Concurrency SVG Chart ───────────────────────────────────────────────
function PeakConcurrencyChart({ data, peakValue }: { data: PeakConcurrencyPoint[]; peakValue: number }) {
  if (data.length === 0 || peakValue === 0) {
    return (
      <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: BRAND.gray400 }}>No concurrency data available</Text>
      </View>
    )
  }

  const W = 475
  const H = 140
  const padL = 32
  const padR = 12
  const padT = 16
  const padB = 28
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const maxVal = Math.max(peakValue, 1)
  const n = data.length

  function xOf(i: number) {
    return padL + (i / Math.max(n - 1, 1)) * chartW
  }
  function yOf(v: number) {
    return padT + (1 - v / maxVal) * chartH
  }

  const points = data.map((d, i) => ({ x: xOf(i), y: yOf(d.peakParticipants), v: d.peakParticipants, date: d.date }))

  // Build area path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${padL.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`

  // Y grid ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: yOf(f * maxVal), v: Math.round(f * maxVal) }))

  // Peak annotation
  const peakPoint = points.reduce((best, p) => (p.v > best.v ? p : best), points[0])

  // X axis labels: show first, middle, last
  const xLabels: { x: number; label: string }[] = []
  if (n > 0) {
    const indices = n <= 3 ? Array.from({ length: n }, (_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]
    for (const i of indices) {
      const d = data[i]
      const date = new Date(d.date)
      const label = `${date.getDate()} ${date.toLocaleString('en-GB', { month: 'short' })}`
      xLabels.push({ x: xOf(i), label })
    }
  }

  return (
    <View style={s.chartContainer}>
      <Svg width={W} height={H}>
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <G key={tick.v}>
            <Line x1={padL} y1={tick.y} x2={W - padR} y2={tick.y} stroke={BRAND.gray200} strokeWidth={0.5} />
            <Text style={{ fontSize: 8, color: BRAND.gray400 }} x={padL - 4} y={tick.y + 3}>{tick.v}</Text>
          </G>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={BRAND.primary} opacity={0.12} />

        {/* Line */}
        <Path d={linePath} stroke={BRAND.primary} strokeWidth={2} fill="none" />

        {/* Data points */}
        {points.map((p, i) => (
          <G key={i}>
            {p.v > 0 && <Rect x={p.x - 2} y={p.y - 2} width={4} height={4} fill={BRAND.primary} rx={2} />}
          </G>
        ))}

        {/* Peak annotation */}
        {peakPoint && peakPoint.v > 0 && (
          <G>
            <Rect x={peakPoint.x - 14} y={peakPoint.y - 22} width={28} height={16} fill={BRAND.primaryDark} rx={4} />
            <Text style={{ fontSize: 9, color: BRAND.white, fontFamily: 'Helvetica-Bold' }}
              x={peakPoint.x} y={peakPoint.y - 11}>{`Peak: ${peakPoint.v}`}</Text>
          </G>
        )}

        {/* X axis labels */}
        {xLabels.map((xl, i) => (
          <Text key={i} style={{ fontSize: 8, color: BRAND.gray500 }} x={xl.x} y={H - 6}>{xl.label}</Text>
        ))}

        {/* X axis line */}
        <Line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke={BRAND.gray200} strokeWidth={1} />
      </Svg>
    </View>
  )
}

// ─── Quality Bars ────────────────────────────────────────────────────────────
function QualityBars({ quality }: { quality: QualitySummary }) {
  const bars = [
    { label: 'Good', pct: quality.goodPct, color: BRAND.emerald },
    { label: 'OK', pct: quality.okPct, color: BRAND.amber },
    { label: 'Bad', pct: quality.badPct, color: '#f97316' },
    { label: 'Terrible', pct: quality.terriblePct, color: BRAND.red },
  ]

  return (
    <View>
      {bars.map((bar) => (
        <View key={bar.label} style={s.qualityRow}>
          <Text style={s.qualityLabel}>{bar.label}</Text>
          <View style={s.qualityBarBg}>
            <View style={[s.qualityBarFill, { width: `${bar.pct}%`, backgroundColor: bar.color }]} />
          </View>
          <Text style={s.qualityPct}>{pct(bar.pct)}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Page Footer ─────────────────────────────────────────────────────────────
function Footer({ period, generated }: { period: string; generated: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Pexip Executive Report · {period}</Text>
      <Text style={s.footerText}>Generated: {generated}</Text>
      <Text style={s.footerTextRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

// ─── Main Document ────────────────────────────────────────────────────────────
export function ExecReportDocument({ data }: { data: ReportData }) {
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const periodStr = `${formatDate(data.period.start)} – ${formatDate(data.period.end)}`
  const isEmpty = data.kpis.totalConferences === 0

  return (
    <Document title="Executive Report" author="Pexip Reporting Dashboard">
      {/* ── Cover Page ────────────────────────────────────────────────── */}
      <Page size="A4" style={[s.page, s.coverPage]}>
        {/* Background gradient simulation via layered rectangles */}
        <Svg style={s.coverGradient} width="595" height="842">
          <Rect x={0} y={0} width={595} height={842} fill={BRAND.dark} />
          <Rect x={0} y={0} width={595} height={420} fill={BRAND.darkAlt} opacity={0.6} />
          {/* Accent circle */}
          <Rect x={320} y={-60} width={360} height={360} rx={180} fill={BRAND.primary} opacity={0.07} />
          <Rect x={380} y={500} width={280} height={280} rx={140} fill={BRAND.accent} opacity={0.05} />
        </Svg>

        <View style={s.coverContent}>
          {/* Logo row */}
          <View style={s.coverLogo}>
            <View style={s.coverLogoBox}>
              <Text style={s.coverLogoText}>P</Text>
            </View>
            <Text style={s.coverBrand}>Pexip Reports</Text>
          </View>

          {/* Rule */}
          <View style={s.coverRule} />

          {/* Title */}
          <Text style={s.coverTitle}>Executive{'\n'}Report</Text>
          <Text style={s.coverSubtitle}>Analytics Summary for Decision Makers</Text>

          {/* Divider */}
          <View style={s.coverDivider} />

          {/* Meta */}
          <View style={s.coverMetaRow}>
            <View>
              <Text style={s.coverMetaLabel}>Reporting Period</Text>
              <Text style={s.coverMetaValue}>{periodStr}</Text>
            </View>
          </View>
          <View style={s.coverMetaRow}>
            <View>
              <Text style={s.coverMetaLabel}>Generated</Text>
              <Text style={s.coverMetaValue}>{generatedAt}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ── Content Pages ──────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Footer period={periodStr} generated={generatedAt} />

        {/* 1. Narrative Summary */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>Executive Summary</Text>
          </View>
          <View style={s.narrativeBox}>
            <Text style={s.narrativeLabel}>Key Findings</Text>
            <Text style={s.narrativeText}>{isEmpty ? 'No meeting data was recorded for the selected period.' : data.narrative}</Text>
          </View>
        </View>

        {/* 2. KPI Overview */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>High-Level Overview</Text>
          </View>
          <View style={s.kpiGrid}>
            <View style={s.kpiTile}>
              <Text style={s.kpiLabel}>Unique VMRs Used</Text>
              <Text style={s.kpiValue}>{data.kpis.uniqueVmrs}</Text>
              <Text style={s.kpiSubtext}>Virtual Meeting Rooms</Text>
            </View>
            <View style={s.kpiTile}>
              <Text style={s.kpiLabel}>Total Meetings</Text>
              <Text style={s.kpiValue}>{data.kpis.totalConferences}</Text>
              <Text style={s.kpiSubtext}>Conferences held</Text>
            </View>
            <View style={s.kpiTile}>
              <Text style={s.kpiLabel}>Total Participants</Text>
              <Text style={s.kpiValue}>{data.kpis.totalParticipants}</Text>
              <Text style={s.kpiSubtext}>Participant sessions</Text>
            </View>
            <View style={s.kpiTile}>
              <Text style={s.kpiLabel}>Meeting Hours</Text>
              <Text style={s.kpiValue}>{data.kpis.totalMeetingHours.toFixed(1)}</Text>
              <Text style={s.kpiSubtext}>Total hours in meetings</Text>
            </View>
          </View>
        </View>

        {/* 3. Peak Concurrency Chart */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>Peak Concurrent Participants</Text>
          </View>
          {isEmpty ? (
            <View style={{ height: 100, justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, color: BRAND.gray400 }}>No data available for the selected period.</Text>
            </View>
          ) : (
            <PeakConcurrencyChart data={data.peakConcurrency} peakValue={data.peakValue} />
          )}
          {data.peakDate && (
            <Text style={{ fontSize: 10, color: BRAND.gray500, marginTop: 6 }}>
              Peak of {data.peakValue} concurrent participant{data.peakValue !== 1 ? 's' : ''} on {formatDate(data.peakDate)}.
            </Text>
          )}
        </View>
      </Page>

      {/* ── Tables Page ───────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Footer period={periodStr} generated={generatedAt} />

        {/* 4. Top VMRs */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>Top 10 Most Used Virtual Meeting Rooms</Text>
          </View>
          {data.topVmrs.length === 0 ? (
            <Text style={{ fontSize: 11, color: BRAND.gray400 }}>No data available.</Text>
          ) : (
            <View>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { flex: 3 }]}>VMR Name</Text>
                <Text style={[s.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Calls</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Duration</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Participants</Text>
              </View>
              {data.topVmrs.map((vmr: TopVmr, i: number) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { flex: 3 }]}>{vmr.name}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{vmr.calls}</Text>
                  <Text style={[s.tableCellRight, { flex: 1.5 }]}>{formatDuration(vmr.totalDurationSeconds)}</Text>
                  <Text style={[s.tableCellRight, { flex: 1.2 }]}>{vmr.participants}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 5. Top Participants */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>Top 10 Most Active Participants</Text>
          </View>
          {data.topParticipants.length === 0 ? (
            <Text style={{ fontSize: 11, color: BRAND.gray400 }}>No data available.</Text>
          ) : (
            <View>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { flex: 3 }]}>Participant</Text>
                <Text style={[s.tableHeaderCell, { flex: 2 }]}>Alias / Identity</Text>
                <Text style={[s.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Calls</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Total Time</Text>
              </View>
              {data.topParticipants.map((p: TopParticipant, i: number) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { flex: 3 }]}>{p.name}</Text>
                  <Text style={[s.tableCellMuted, { flex: 2 }]}>{p.alias ?? '—'}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{p.calls}</Text>
                  <Text style={[s.tableCellRight, { flex: 1.5 }]}>{formatDuration(p.totalDurationSeconds)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>

      {/* ── Quality Page ──────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Footer period={periodStr} generated={generatedAt} />

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>Overall Call Quality</Text>
          </View>

          {data.quality.total === 0 ? (
            <Text style={{ fontSize: 11, color: BRAND.gray400 }}>No quality data available for the selected period.</Text>
          ) : (
            <>
              {/* Quality KPI row */}
              <View style={s.qualityKpiRow}>
                <View style={s.qualityKpiTile}>
                  <Text style={[s.qualityKpiValue, { color: BRAND.emerald }]}>{pct(data.quality.goodPct)}</Text>
                  <Text style={s.qualityKpiLabel}>Good Quality</Text>
                </View>
                <View style={s.qualityKpiTile}>
                  <Text style={[s.qualityKpiValue, { color: BRAND.amber }]}>{pct(data.quality.okPct)}</Text>
                  <Text style={s.qualityKpiLabel}>OK Quality</Text>
                </View>
                <View style={s.qualityKpiTile}>
                  <Text style={[s.qualityKpiValue, { color: '#f97316' }]}>{pct(data.quality.badPct)}</Text>
                  <Text style={s.qualityKpiLabel}>Bad Quality</Text>
                </View>
                <View style={s.qualityKpiTile}>
                  <Text style={[s.qualityKpiValue, { color: BRAND.red }]}>{pct(data.quality.terriblePct)}</Text>
                  <Text style={s.qualityKpiLabel}>Terrible</Text>
                </View>
              </View>

              {/* Bar chart */}
              <View style={{ marginBottom: 20 }}>
                <QualityBars quality={data.quality} />
              </View>

              {/* Secondary KPIs */}
              <View style={s.kpiGrid}>
                <View style={s.kpiTile}>
                  <Text style={s.kpiLabel}>Calls Measured</Text>
                  <Text style={[s.kpiValue, { fontSize: 18 }]}>{data.quality.total}</Text>
                  <Text style={s.kpiSubtext}>Participants with quality data</Text>
                </View>
                <View style={s.kpiTile}>
                  <Text style={s.kpiLabel}>Avg Packet Loss</Text>
                  <Text style={[s.kpiValue, { fontSize: 18 }]}>
                    {data.quality.avgPacketLossPct !== null ? `${data.quality.avgPacketLossPct.toFixed(2)}%` : 'N/A'}
                  </Text>
                  <Text style={s.kpiSubtext}>Across all media streams</Text>
                </View>
                <View style={s.kpiTile}>
                  <Text style={s.kpiLabel}>Avg Jitter</Text>
                  <Text style={[s.kpiValue, { fontSize: 18 }]}>
                    {data.quality.avgJitterMs !== null ? `${data.quality.avgJitterMs} ms` : 'N/A'}
                  </Text>
                  <Text style={s.kpiSubtext}>Across all media streams</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </Page>
    </Document>
  )
}
