'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  peakParticipants: number
}

interface PeakConcurrencyChartProps {
  data: DataPoint[]
}

export function PeakConcurrencyChart({ data }: PeakConcurrencyChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    displayDate: format(new Date(d.date), 'MMM d'),
  }))

  if (formatted.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-gray-400 dark:text-gray-500 text-sm">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" />
        <XAxis dataKey="displayDate" tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid var(--chart-border, #e5e7eb)',
            backgroundColor: 'var(--chart-tooltip-bg, #ffffff)',
            color: 'var(--chart-tooltip-text, #1f2937)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          formatter={(value: string) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>}
        />
        <Line type="monotone" dataKey="peakParticipants" stroke="#3b8eff" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Peak Participants" />
      </LineChart>
    </ResponsiveContainer>
  )
}
