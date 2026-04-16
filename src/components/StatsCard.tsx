import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'teal'
  href?: string
}

const colorMap = {
  blue: {
    bg: 'bg-accent-50 dark:bg-accent-500/10',
    icon: 'text-accent-600 dark:text-accent-400',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
  },
  purple: {
    bg: 'bg-primary-50 dark:bg-primary-500/10',
    icon: 'text-primary-600 dark:text-primary-400',
  },
  teal: {
    bg: 'bg-primary-50 dark:bg-primary-500/10',
    icon: 'text-primary-600 dark:text-primary-400',
  },
}

export function StatsCard({ title, value, subtitle, icon: Icon, color = 'teal', href }: StatsCardProps) {
  const colors = colorMap[color]

  const content = (
    <div className={`glass-card rounded-2xl shadow-glass p-6 transition-all duration-200 ${href ? 'hover:shadow-glass-hover cursor-pointer hover:-translate-y-0.5' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`${colors.bg} p-3 rounded-2xl`}>
            <Icon size={22} className={colors.icon} />
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
