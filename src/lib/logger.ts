import { prisma } from '@/lib/prisma'

export type LogLevel = 'info' | 'warn' | 'error'

export async function log(
  level: LogLevel,
  message: string,
  options?: { details?: string; source?: string }
) {
  try {
    await prisma.log.create({
      data: {
        level,
        message,
        details: options?.details ?? null,
        source: options?.source ?? null,
      },
    })
  } catch (err) {
    // Fallback to console so logging failures don't break the app
    console.error('Failed to persist log entry:', err)
  }
  // Also mirror to server console for convenience
  const tag = options?.source ? `[${options.source}]` : ''
  const line = `${tag} ${message}${options?.details ? ' — ' + options.details : ''}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
