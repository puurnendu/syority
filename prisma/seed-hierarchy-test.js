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
        console.log('🌱 Seeding Verification Hierarchy (JS Robust Version)...');

        const orgs = await prisma.organization.findMany();
        const org = orgs.find(o => o.slug === 'syority' || o.name === 'SYORITY Corporation') || orgs[0];
        
        if (!org) throw new Error('No organization found.');
        console.log(`Using Org: ${org.name} (${org.id})`);

        const sites = await prisma.site.findMany({ where: { organization_id: org.id } });
        const site = sites.find(s => s.code === 'HQ') || sites[0];
        
        if (!site) throw new Error('No site found.');
        console.log(`Using Site: ${site.name} (${site.id})`);

        // 1. Create Event
        let event = await prisma.event.findFirst({
            where: { organization_id: org.id, code: 'STO-2026' }
        });
        if (!event) {
            event = await prisma.event.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    code: 'STO-2026',
                    name: 'Annual Shutdown 2026',
                    status: 'planning',
                    planned_start: new Date('2026-05-01'),
                    planned_end: new Date('2026-06-01'),
                }
            });
            console.log('✅ Created Event:', event.code);
        } else {
            console.log('ℹ️ Event already exists:', event.code);
        }

        // 2. Create Hierarchy
        let plant = await prisma.plant.findFirst({ where: { organization_id: org.id, code: 'PLANT-A' } });
        if (!plant) {
            plant = await prisma.plant.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    code: 'PLANT-A',
                    name: 'Process Plant A',
                }
            });
            console.log('✅ Created Plant:', plant.code);
        } else {
            console.log('ℹ️ Plant already exists:', plant.code);
        }

        let unit = await prisma.unit.findFirst({ where: { organization_id: org.id, code: 'UNIT-100' } });
        if (!unit) {
            unit = await prisma.unit.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    plant_id: plant.id,
                    code: 'UNIT-100',
                    name: 'Crude Distillation Unit',
                }
            });
            console.log('✅ Created Unit:', unit.code);
        } else {
            console.log('ℹ️ Unit already exists:', unit.code);
        }

        let system = await prisma.system.findFirst({ where: { organization_id: org.id, code: 'SYS-OIL' } });
        if (!system) {
            system = await prisma.system.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    unit_id: unit.id,
                    code: 'SYS-OIL',
                    name: 'Oil Feed System',
                }
            });
            console.log('✅ Created System:', system.code);
        } else {
            console.log('ℹ️ System already exists:', system.code);
        }

        let asset = await prisma.asset.findFirst({ where: { organization_id: org.id, tag_number: 'E-101' } });
        if (!asset) {
            asset = await prisma.asset.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    system_id: system.id,
                    tag_number: 'E-101',
                    name: 'Heat Exchanger',
                    asset_type: 'Exchanger',
                }
            });
            console.log('✅ Created Asset:', asset.tag_number);
        } else {
            console.log('ℹ️ Asset already exists:', asset.tag_number);
        }

        // 3. Create Scope (Nozzle & Joints)
        const nozzleName = 'N1';
        let nozzle = await prisma.nozzle.findFirst({ where: { asset_id: asset.id, designation: nozzleName } });
        if (!nozzle) {
            nozzle = await prisma.nozzle.create({
                data: {
                    organization_id: org.id,
                    asset_id: asset.id,
                    designation: nozzleName,
                    service: 'Inlet',
                }
            });
            console.log('✅ Created Nozzle:', nozzle.designation);
        } else {
            console.log('ℹ️ Nozzle already exists:', nozzle.designation);
        }

        const jointNozzleNum = 'J-E101-N1';
        let jointMaster = await prisma.jointMaster.findFirst({ where: { organization_id: org.id, joint_number: jointNozzleNum } });
        if (!jointMaster) {
            jointMaster = await prisma.jointMaster.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    asset_id: asset.id,
                    nozzle_id: nozzle.id,
                    joint_number: jointNozzleNum,
                    flange_size: '8"',
                    pressure_rating: '300#',
                }
            });
            console.log('✅ Created Joint Master (Nozzle):', jointMaster.joint_number);
        } else {
            console.log('ℹ️ Joint Master (Nozzle) already exists:', jointMaster.joint_number);
        }

        const lineNum = '8-OIL-1001-A1';
        let line = await prisma.lineList.findFirst({ where: { organization_id: org.id, line_number: lineNum } });
        if (!line) {
            line = await prisma.lineList.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    asset_id: asset.id,
                    line_number: lineNum,
                }
            });
            console.log('✅ Created Line List:', line.line_number);
        } else {
            console.log('ℹ️ Line List already exists:', line.line_number);
        }

        const jointLineNum = 'J-L1001-01';
        let lineJoint = await prisma.jointMaster.findFirst({ where: { organization_id: org.id, joint_number: jointLineNum } });
        if (!lineJoint) {
            lineJoint = await prisma.jointMaster.create({
                data: {
                    organization_id: org.id,
                    site_id: site.id,
                    asset_id: asset.id,
                    line_id: line.id,
                    joint_number: jointLineNum,
                    flange_size: '8"',
                    pressure_rating: '300#',
                }
            });
            console.log('✅ Created Joint Master (Line):', lineJoint.joint_number);
        } else {
            console.log('ℹ️ Joint Master (Line) already exists:', lineJoint.joint_number);
        }


        console.log('🎉 Verification Hierarchy Seeded Successfully!');
    } catch (err) {
        console.error('❌ Error during hierarchy seeding:', err.message);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
