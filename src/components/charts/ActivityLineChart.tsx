'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  count: number
}

interface ActivityLineChartProps {
  data: DataPoint[]
}

export function ActivityLineChart({ data }: ActivityLineChartProps) {
  const formatted = data.map(d => ({
    ...d,
    displayDate: format(new Date(d.date), 'MMM d')
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} tickLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="Conferences"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
