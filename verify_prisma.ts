import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Testing activity count...')
    const activityCount = await prisma.activity.count()
    console.log('activity count:', activityCount)

    console.log('Testing constraintLog count...')
    const constraintCount = await prisma.constraintLog.count()
    console.log('constraintLog count:', constraintCount)

    console.log('Testing system count...')
    const systemCount = await prisma.system.count()
    console.log('system count:', systemCount)

    console.log('Success: All camelCase model access tests passed!')
  } catch (err) {
    console.error('Verification failed:', err)
    process.exit(1)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
