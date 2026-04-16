'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  avgQuality: number | null
  sampleCount: number
}

interface QualityTrendChartProps {
  data: DataPoint[]
}

export function QualityTrendChart({ data }: QualityTrendChartProps) {
  const formatted = data
    .filter((d) => d.avgQuality !== null)
    .map((d) => ({
      ...d,
      displayDate: format(new Date(d.date), 'MMM d'),
    }))

  if (formatted.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-gray-400 dark:text-gray-500 text-sm">No quality trend data available</div>
  }

  const qualityLabel = (value: number) => {
    if (value <= 1) return 'Good'
    if (value <= 2) return 'OK'
    if (value <= 3) return 'Bad'
    return 'Terrible'
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" />
        <XAxis dataKey="displayDate" tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }} tickLine={false} />
        <YAxis
          domain={[1, 4]}
          ticks={[1, 2, 3, 4]}
          tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={qualityLabel}
          reversed
        />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid var(--chart-border, #e5e7eb)',
            backgroundColor: 'var(--chart-tooltip-bg, #ffffff)',
            color: 'var(--chart-tooltip-text, #1f2937)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(value, _name, item) => {
            const num = typeof value === 'number' ? value : 0
            const samples = (item as { payload?: { sampleCount?: number } })?.payload?.sampleCount ?? 0
            return [`${qualityLabel(num)} (${num.toFixed(2)}) — ${samples} samples`, 'Avg Quality']
          }}
        />
        <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'OK threshold', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
        <ReferenceLine y={3} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Bad threshold', position: 'right', fontSize: 10, fill: '#ef4444' }} />
        <Line
          type="monotone"
          dataKey="avgQuality"
          stroke="#05c8aa"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#05c8aa', stroke: '#fff', strokeWidth: 2 }}
          name="Avg Quality"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
