'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface VMRBarData {
  name: string
  count: number
}

export function TopVMRsBarChart({ data }: { data: VMRBarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Conferences" />
      </BarChart>
    </ResponsiveContainer>
  )
}
