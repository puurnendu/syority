const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    try {
        console.log('🧹 Cleaning up Verification Hierarchy data...');

        // Delete in reverse order of dependencies
        await prisma.jointMaster.deleteMany({ where: { joint_number: { in: ['J-E101-N1', 'J-L1001-01'] } } });
        await prisma.nozzle.deleteMany({ where: { designation: 'N1' } });
        await prisma.lineList.deleteMany({ where: { line_number: '8-OIL-1001-A1' } });
        await prisma.asset.deleteMany({ where: { tag_number: 'E-101' } });
        await prisma.system.deleteMany({ where: { code: 'SYS-OIL' } });
        await prisma.unit.deleteMany({ where: { code: 'UNIT-100' } });
        await prisma.plant.deleteMany({ where: { code: 'PLANT-A' } });
        await prisma.event.deleteMany({ where: { code: 'STO-2026' } });

        console.log('✅ Cleanup complete.');
    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
