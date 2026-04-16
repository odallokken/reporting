import { prisma } from '@/lib/prisma'

export async function getMinDurationSeconds(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'minDurationSeconds' } })
  return setting ? parseInt(setting.value) || 0 : 0
}

/**
 * Returns IDs of conferences whose duration is shorter than the configured
 * minimum threshold. Ongoing conferences (endTime IS NULL) are never excluded.
 */
export async function getShortConferenceIds(): Promise<number[]> {
  const minDuration = await getMinDurationSeconds()
  if (minDuration <= 0) return []

  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM Conference
    WHERE endTime IS NOT NULL
      AND (julianday(endTime) - julianday(startTime)) * 86400 < ${minDuration}
  `
  return rows.map(r => r.id)
}
