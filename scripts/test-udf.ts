import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log('Fetching organization...');
        const org = await prisma.organization.findFirst();
        if (!org) {
            console.error('No organization found');
            return;
        }
        console.log('Org found:', org.id);

        console.log('Creating UDF definition...');
        const udf = await prisma.activityUdfDefinition.create({
            data: {
                organization_id: org.id,
                name: 'Test UDF',
                code: 'test_udf',
                type: 'text',
                is_mandatory: false,
                is_active: true,
            },
        });
        console.log('UDF created:', udf.id);
    } catch (error: any) {
        console.error('ERROR:', error);
        if (error.cause) console.error('CAUSE:', JSON.stringify(error.cause, null, 2));
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
