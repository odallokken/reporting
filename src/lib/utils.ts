import { formatDistanceToNow, format } from 'date-fns'

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
