'use client'

import { useState } from 'react'
import { format, subDays, startOfMonth, startOfYear, startOfQuarter, subYears, subMonths } from 'date-fns'
import { FileDown, AlertCircle, Loader2, Calendar, FileText } from 'lucide-react'

type Preset = {
  label: string
  getRange: () => { start: Date; end: Date }
}

const today = () => new Date()

const PRESETS: Preset[] = [
  { label: 'Last 7 days', getRange: () => ({ start: subDays(today(), 6), end: today() }) },
  { label: 'Last 30 days', getRange: () => ({ start: subDays(today(), 29), end: today() }) },
  { label: 'Last 90 days', getRange: () => ({ start: subDays(today(), 89), end: today() }) },
  { label: 'Last quarter', getRange: () => ({ start: startOfQuarter(subMonths(today(), 3)), end: today() }) },
  { label: 'Last year', getRange: () => ({ start: subYears(today(), 1), end: today() }) },
  { label: 'Month-to-date', getRange: () => ({ start: startOfMonth(today()), end: today() }) },
  { label: 'Year-to-date', getRange: () => ({ start: startOfYear(today()), end: today() }) },
]

function toInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<string>(toInputValue(subDays(new Date(), 29)))
  const [endDate, setEndDate] = useState<string>(toInputValue(new Date()))
  const [activePreset, setActivePreset] = useState<string>('Last 30 days')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyPreset(preset: Preset) {
    const { start, end } = preset.getRange()
    setStartDate(toInputValue(start))
    setEndDate(toInputValue(end))
    setActivePreset(preset.label)
    setError(null)
  }

  function validate(): string | null {
    if (!startDate || !endDate) return 'Please select both a start and end date.'
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'Invalid date values.'
    if (s > e) return 'Start date must be on or before end date.'
    if (e > new Date()) return 'End date cannot be in the future.'
    return null
  }

  async function handleGenerate() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setLoading(true)

    try {
      const params = new URLSearchParams({ start: startDate, end: endDate })
      const response = await fetch(`/api/reports/pdf?${params.toString()}`)

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error (${response.status})`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `executive-report-${startDate.replace(/-/g, '')}-to-${endDate.replace(/-/g, '')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary-50 dark:bg-primary-500/10 p-2.5 rounded-xl">
            <FileText size={22} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Report</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mt-1 ml-14">
          Generate a glossy, C-level PDF report summarising the most important metrics for a selected time period.
        </p>
      </div>

      <div className="glass-card rounded-2xl shadow-glass p-6 mb-6">
        {/* Presets */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <Calendar size={14} className="inline mr-1.5 mb-0.5" />
            Quick presets
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                  activePreset === preset.label
                    ? 'bg-primary-500/15 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500/30'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom range */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom date range</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="report-start" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date</label>
              <input
                id="report-start"
                type="date"
                value={startDate}
                max={endDate || toInputValue(new Date())}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setActivePreset('')
                  setError(null)
                }}
                className="w-full px-3 py-2 border border-gray-200/60 dark:border-gray-700/40 bg-white/60 dark:bg-surface-dark-card/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-end pb-2 text-gray-400 hidden sm:block">–</div>
            <div className="flex-1">
              <label htmlFor="report-end" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End date</label>
              <input
                id="report-end"
                type="date"
                value={endDate}
                min={startDate}
                max={toInputValue(new Date())}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setActivePreset('')
                  setError(null)
                }}
                className="w-full px-3 py-2 border border-gray-200/60 dark:border-gray-700/40 bg-white/60 dark:bg-surface-dark-card/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 mb-4">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold text-sm shadow-lg shadow-primary-500/20 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating PDF…
            </>
          ) : (
            <>
              <FileDown size={16} />
              Generate & Download PDF
            </>
          )}
        </button>
      </div>

      {/* Info box */}
      <div className="glass-card rounded-2xl shadow-glass p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">What&apos;s included in the report</h2>
        <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          {[
            'Cover page with period and generation timestamp',
            'Executive summary with auto-generated key findings narrative',
            'High-level KPI overview: VMRs, meetings, participants, hours',
            'Peak concurrent participants chart over the selected period',
            'Top 10 most used Virtual Meeting Rooms',
            'Top 10 most active participants',
            'Call quality breakdown: good / OK / bad / terrible, packet loss, jitter',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
