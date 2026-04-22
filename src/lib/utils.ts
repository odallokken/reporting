import { formatDistanceToNow, format, subDays, subYears } from 'date-fns'

export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'Never'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return '-'
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

export function formatDuration(startTime: Date | string, endTime: Date | string | null): string {
  if (!endTime) return 'Ongoing'
  const start = new Date(startTime)
  const end = new Date(endTime)
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getStaticVmrStatus(lastUsedAt: string | null): { label: string; className: string; rank: number } {
  if (!lastUsedAt) {
    return { label: 'Inactive', className: 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400', rank: 2 }
  }
  const lastUsed = new Date(lastUsedAt)
  const now = new Date()
  if (lastUsed >= subDays(now, 30)) {
    return { label: 'Active', className: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400', rank: 0 }
  }
  if (lastUsed >= subYears(now, 1)) {
    return { label: 'Stale', className: 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400', rank: 1 }
  }
  return { label: 'Inactive', className: 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400', rank: 2 }
}
