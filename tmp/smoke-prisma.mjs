import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const apiKey = await prisma.apiKey.findMany({ take: 1 });
  const webhookConfig = await prisma.webhookConfig.findMany({ take: 1 });
  const webhookLog = await prisma.webhookLog.findMany({ take: 1 });
  const area = await prisma.area.findMany({ take: 1 });
  console.log(
    JSON.stringify({
      apiKey: typeof prisma.apiKey?.findMany,
      webhookConfig: typeof prisma.webhookConfig?.findUnique,
      webhookLog: typeof prisma.webhookLog?.findMany,
      area: typeof prisma.area?.findMany,
      counts: {
        apiKey: apiKey.length,
        webhookConfig: webhookConfig.length,
        webhookLog: webhookLog.length,
        area: area.length,
      },
    })
  );
} finally {
  await prisma['$disconnect']();
  await pool.end();
}
