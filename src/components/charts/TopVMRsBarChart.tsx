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
        <Bar dataKey="count" fill="#7c3aed" radius={[6, 6, 0, 0]} name="Conferences" />
      </BarChart>
    </ResponsiveContainer>
  )
}
