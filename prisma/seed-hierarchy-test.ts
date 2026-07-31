import { prisma, disconnect } from './seed-client';

async function main() {
    console.log('🌱 Seeding Verification Hierarchy (Robust Version)...');

    const org = await prisma.organization.findFirst({ 
        where: { OR: [{ slug: 'syority' }, { name: 'SYORITY Corporation' }] } 
    });
    if (!org) throw new Error('SYORITY org not found. Run npm run seed:syority first.');
    console.log(`Using Org: ${org.name} (${org.id})`);

    const site = await prisma.site.findFirst({ where: { organization_id: org.id, code: 'HQ' } });
    if (!site) throw new Error('SYORITY HQ site not found.');
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
                rating: '300#',
            }
        });
        console.log('✅ Created Joint Master (Nozzle):', jointMaster.joint_number);
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
    }

    const jointLineNum = 'J-L1001-01';
    let lineJoint = await prisma.jointMaster.findFirst({ where: { organization_id: org.id, joint_number: jointLineNum } });
    if (!lineJoint) {
        lineJoint = await prisma.jointMaster.create({
            data: {
                organization_id: org.id,
                site_id: site.id,
                asset_id: asset.id,
                line_number: line.line_number,
                joint_number: jointLineNum,
                flange_size: '8"',
                rating: '300#',
            }
        });
        console.log('✅ Created Joint Master (Line):', lineJoint.joint_number);
    }

    console.log('🎉 Verification Hierarchy Seeded Successfully!');
}

main()
    .catch(e => {
        console.error('❌ Seed failed:', e.message);
        process.exit(1);
    })
    .finally(async () => {
        await disconnect();
    });
