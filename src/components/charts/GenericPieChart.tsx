'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface DataPoint {
  name: string
  value: number
}

interface GenericPieChartProps {
  data: DataPoint[]
  colors?: string[]
}

const DEFAULT_COLORS = ['#05c8aa', '#3b8eff', '#10b981', '#f59e0b', '#ef4444', '#1de4c3', '#ec4899', '#06b6d4', '#84cc16', '#f97316']

export function GenericPieChart({ data, colors = DEFAULT_COLORS }: GenericPieChartProps) {
  const filtered = data.filter((d) => d.value > 0)

  if (filtered.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-gray-400 dark:text-gray-500 text-sm">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {filtered.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid var(--chart-border, #e5e7eb)',
            backgroundColor: 'var(--chart-tooltip-bg, #ffffff)',
            color: 'var(--chart-tooltip-text, #1f2937)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : 0
            const total = filtered.reduce((a, b) => a + b.value, 0)
            return [`${num} (${total > 0 ? ((num / total) * 100).toFixed(1) : 0}%)`, String(name)]
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value: string) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
