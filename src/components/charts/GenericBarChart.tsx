'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  name: string
  value: number
}

interface GenericBarChartProps {
  data: DataPoint[]
  color?: string
  height?: number
  label?: string
}

export function GenericBarChart({ data, color = '#7c3aed', height = 300, label = 'Count' }: GenericBarChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style={{ height }}>No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--chart-text, #6b7280)' }}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
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
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} name={label} />
      </BarChart>
    </ResponsiveContainer>
  )
}
