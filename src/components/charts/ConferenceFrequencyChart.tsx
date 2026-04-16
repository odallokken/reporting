'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  count: number
}

export function ConferenceFrequencyChart({ data }: { data: DataPoint[] }) {
  const formatted = data.map(d => ({
    ...d,
    displayDate: format(new Date(d.date), 'MMM d')
  }))

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={formatted} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" />
        <XAxis dataKey="displayDate" tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--chart-text, #6b7280)' }} tickLine={false} axisLine={false} allowDecimals={false} />
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
        <Line
          type="monotone"
          dataKey="count"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
          name="Conferences"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
