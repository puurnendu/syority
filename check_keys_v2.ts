import { PrismaClient } from '@prisma/client'
// @ts-ignore
const prisma = new PrismaClient()
const proto = Object.getPrototypeOf(prisma)

console.log('Searching for model names in Prisma keys...')
const allKeys = [...Object.getOwnPropertyNames(prisma), ...Object.getOwnPropertyNames(proto)]
const models = ['ConstraintLog', 'constraintLog', 'constraint_logs', 'Activity', 'activity', 'activities']

models.forEach(m => {
  if (allKeys.includes(m)) {
    console.log(`FOUND: ${m}`)
  }
})

console.log('First 50 keys of Prisma:', allKeys.filter(k => !k.startsWith('_')).slice(0, 50))
