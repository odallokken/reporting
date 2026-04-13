import { PrismaClient } from '@prisma/client'
import { subDays, subHours } from 'date-fns'

const prisma = new PrismaClient()

const vmrNames = [
  'Sales Team Room',
  'Engineering Standup',
  'Executive Boardroom',
  'Support Escalation',
  'HR Interview Room',
  'Product Demo Room',
  'Customer Success Hub',
  'DevOps War Room',
  'Marketing Strategy',
  'Finance Review',
  'Training Room A',
  'Partner Portal',
  'All Hands Meeting',
  'Leadership Sync',
  'Sprint Planning',
]

const participantNames = [
  'Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown',
  'Emma Davis', 'Frank Miller', 'Grace Wilson', 'Henry Moore',
  'Isabella Taylor', 'James Anderson', 'Katherine Thomas', 'Liam Jackson',
  'Mia White', 'Noah Harris', 'Olivia Martin', 'Paul Thompson',
  'Quinn Garcia', 'Rachel Martinez', 'Samuel Robinson', 'Tara Clark'
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('Seeding database...')

  await prisma.participant.deleteMany()
  await prisma.conference.deleteMany()
  await prisma.vMR.deleteMany()

  const vmrs = await Promise.all(
    vmrNames.map(async (name, index) => {
      const daysAgo = index < 10 ? randomInt(0, 20) : randomInt(31, 90)
      const lastUsedAt = subDays(new Date(), daysAgo)
      return prisma.vMR.create({
        data: { name, lastUsedAt, createdAt: subDays(new Date(), 120) }
      })
    })
  )

  console.log(`Created ${vmrs.length} VMRs`)

  let confCount = 0
  let partCount = 0

  for (const vmr of vmrs.slice(0, 12)) {
    const numConferences = randomInt(3, 15)
    for (let i = 0; i < numConferences; i++) {
      const daysAgo = randomInt(0, 30)
      const startTime = subHours(subDays(new Date(), daysAgo), randomInt(0, 23))
      const durationMinutes = randomInt(15, 120)
      const actualEndTime = new Date(startTime.getTime() + durationMinutes * 60000)

      const conf = await prisma.conference.create({
        data: {
          vmrId: vmr.id,
          startTime,
          endTime: actualEndTime,
          callId: `call-${vmr.id}-${i}-${Date.now()}`,
          createdAt: startTime
        }
      })
      confCount++

      const numParticipants = randomInt(2, 8)
      for (let j = 0; j < numParticipants; j++) {
        const joinOffset = randomInt(0, 5)
        const joinTime = new Date(startTime.getTime() + joinOffset * 60000)
        const leaveTime = new Date(actualEndTime.getTime() - randomInt(0, 10) * 60000)

        await prisma.participant.create({
          data: {
            conferenceId: conf.id,
            name: randomItem(participantNames),
            joinTime,
            leaveTime: leaveTime > joinTime ? leaveTime : actualEndTime,
            callUuid: `uuid-${conf.id}-${j}-${Date.now()}-${Math.random()}`,
            createdAt: joinTime
          }
        })
        partCount++
      }
    }
  }

  console.log(`Created ${confCount} conferences with ${partCount} participants`)
  console.log('Seeding complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
