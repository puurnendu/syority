import { prisma } from './src/lib/prisma';

async function test() {
    try {
        console.log('Checking prisma.featureFlag...');
        console.log('Type of prisma.featureFlag:', typeof (prisma as any).featureFlag);
        const flags = await (prisma as any).featureFlag.findMany();
        console.log('Flags:', flags);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

test();
