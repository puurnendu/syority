import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const logs = await prisma.aiLog.findMany({
            where: { status: 'failed' },
            orderBy: { created_at: 'desc' },
            take: 1
        });
        console.log(JSON.stringify(logs, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
