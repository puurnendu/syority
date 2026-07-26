import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
console.log('Prisma Client keys:', Object.keys(prisma).filter(k => !k.startsWith('_')))

console.log('ConstraintLog present?', 'ConstraintLog' in prisma)
console.log('constraintLog present?', 'constraintLog' in prisma)
console.log('constraint_logs present?', 'constraint_logs' in prisma)

console.log('Activity present?', 'Activity' in prisma)
console.log('activity present?', 'activity' in prisma)
console.log('activities present?', 'activities' in prisma)
