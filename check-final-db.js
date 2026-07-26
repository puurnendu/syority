const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString,
    max: 10,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    try {
        console.log('--- FINAL DATABASE VERIFICATION ---');
        
        const orgs = await prisma.organization.findMany();
        console.log('✅ Organizations:', orgs.length);
        orgs.forEach(o => console.log(`   - ${o.name} (${o.id})`));
        
        if (orgs.length > 0) {
            const org = orgs.find(o => o.name === 'SYORITY Corporation') || orgs.find(o => o.name === 'Syority Technologies') || orgs[0];
            const orgId = org.id;
            console.log(`Using Org: ${org.name} (${org.id})`);
            
            const sites = await prisma.site.findMany({ where: { organization_id: orgId } });
            console.log('✅ Sites:', sites.length);
            
            if (sites.length > 0) {
                const siteId = sites[0].id;
                console.log(`Using Site: ${sites[0].name}`);
                
                const events = await prisma.event.count({ where: { site_id: siteId } });
                console.log('✅ Events:', events);
                
                const plants = await prisma.plant.count({ where: { site_id: siteId } });
                console.log('✅ Plants:', plants);
                
                const units = await prisma.unit.count({ where: { site_id: siteId } });
                console.log('✅ Units:', units);
                
                const systems = await prisma.system.count({ where: { site_id: siteId } });
                console.log('✅ Systems:', systems);
                
                const assets = await prisma.asset.count({ where: { site_id: siteId, deleted_at: null } });
                console.log('✅ Assets:', assets);
                
                const joints = await prisma.jointMaster.count({ where: { organization_id: orgId } });
                console.log('✅ Joint Masters (for Org):', joints);
                
                const totalJoints = await prisma.jointMaster.count();
                console.log('✅ TOTAL Joint Masters in DB:', totalJoints);
            }
        }
        
    } catch (err) {
        console.error('❌ Error during verification:', err.message);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();

