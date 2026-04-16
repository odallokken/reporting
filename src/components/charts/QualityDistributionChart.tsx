'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

interface DataPoint {
  name: string
  value: number
}

interface QualityDistributionChartProps {
  data: DataPoint[]
}

const QUALITY_COLORS: Record<string, string> = {
  good: '#10b981',
  ok: '#f59e0b',
  bad: '#f97316',
  terrible: '#ef4444',
  unknown: '#9ca3af',
}

export function QualityDistributionChart({ data }: QualityDistributionChartProps) {
  if (data.every((d) => d.value === 0)) {
    return <div className="flex items-center justify-center h-[300px] text-gray-400 dark:text-gray-500 text-sm">No quality data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }}
          tickLine={false}
          tickFormatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
        />
        <YAxis tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid var(--chart-border, #e5e7eb)',
            backgroundColor: 'var(--chart-tooltip-bg, #ffffff)',
            color: 'var(--chart-tooltip-text, #1f2937)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          labelStyle={{ fontWeight: 600, textTransform: 'capitalize' }}
          formatter={(value) => [String(value), 'Participants']}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={QUALITY_COLORS[entry.name] ?? '#9ca3af'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
