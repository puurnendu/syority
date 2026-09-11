/**
 * VALIDATION PLANT SEED FOUNDATION
 * Syority Turnaround Management Platform
 * 
 * Living Reference Complex: Apex Euro Refining & Petrochemicals Complex
 * Organization: auriana-refining ("Auriana Refining & Petrochemicals Corp")
 * Site: EUR-S1 ("Antwerp Refining Complex")
 * 
 * Version: 1.3.0
 * Status: APPROVED ARCHITECTURE
 * 
 * Governance Mandate:
 * 1. The Validation Plant is a PERMANENT LIVING REFERENCE PLANT, NOT disposable test data.
 * 2. Every major release preserves and regression-tests against it.
 * 3. Incorporates realistic refinery topology (Plant -> Area -> Unit -> System -> Assets).
 * 4. Connects governed Workpacks and Activities to StandardActivityTypes and Controlled UDFs.
 * 5. Strictly idempotent and safe to re-run.
 */

import { prisma, disconnect } from '../seed-client';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { DISCIPLINES } from '../demo/activityCodes';

export async function runValidationPlantSeed() {
  console.log('\n======================================================');
  console.log('🏭 RUNNING VALIDATION PLANT SEED (APEX EURO REFINERY)...');
  console.log('======================================================\n');

  // ── 1. Reference Tenant Organization ─────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'auriana-refining' },
    update: {
      name: 'Auriana Refining & Petrochemicals Corp',
      is_active: true,
      deployment_model: 'tenant',
      plan_tier: 'enterprise',
      status: 'active',
    },
    create: {
      id: randomUUID(),
      name: 'Auriana Refining & Petrochemicals Corp',
      slug: 'auriana-refining',
      industry: 'Petroleum Refining',
      country: 'Belgium',
      timezone: 'Europe/Brussels',
      is_active: true,
      deployment_model: 'tenant',
      plan_tier: 'enterprise',
      status: 'active',
      notes: 'Permanent living reference turnaround complex (Apex Euro Refining Complex).',
      updated_at: new Date(),
    },
  });
  console.log(`✅ Organization: ${org.name} (${org.id})`);

  // ── 2. Reference Lead Planner User ───────────────────────────────
  const passwordHash = await bcrypt.hash('Syority2028!Refining', 10);
  const plannerUser = await prisma.user.upsert({
    where: { email: 'planner@auriana-refining.com' },
    update: {
      organization_id: org.id,
      name: 'Marc De Smet (Lead Turnaround Planner)',
      is_active: true,
    },
    create: {
      id: randomUUID(),
      organization_id: org.id,
      email: 'planner@auriana-refining.com',
      name: 'Marc De Smet (Lead Turnaround Planner)',
      password: passwordHash,
      position: 'Lead Turnaround Planner',
      is_active: true,
      is_tenant_admin: true,
      updated_at: new Date(),
    },
  });
  console.log(`✅ Lead Planner: ${plannerUser.name} (${plannerUser.id})`);

  // ── 3. Reference Site (EUR-S1) ───────────────────────────────────
  const site = await prisma.site.upsert({
    where: {
      organization_id_code: {
        organization_id: org.id,
        code: 'EUR-S1',
      },
    },
    update: {
      name: 'Antwerp Refining Complex',
      location: 'Port of Antwerp-Bruges, Belgium',
      is_active: true,
    },
    create: {
      id: randomUUID(),
      organization_id: org.id,
      code: 'EUR-S1',
      name: 'Antwerp Refining Complex',
      location: 'Port of Antwerp-Bruges, Belgium',
      timezone: 'Europe/Brussels',
      is_active: true,
    },
  });
  console.log(`✅ Site: ${site.name} (${site.code})`);

  // ── 4. Tenant Disciplines ────────────────────────────────────────
  const disciplineMap = new Map<string, string>();
  for (const d of DISCIPLINES) {
    let disc = await prisma.discipline.findFirst({
      where: { organization_id: org.id, code: d.code },
    });
    if (!disc) {
      disc = await prisma.discipline.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          name: d.name,
          code: d.code,
          color: getDisciplineColor(d.code),
          is_active: true,
          updated_at: new Date(),
        },
      });
    }
    disciplineMap.set(d.code, disc.id);
  }
  console.log(`✅ Tenant Disciplines verified: ${disciplineMap.size}`);

  // ── 5. Permanent Plant (CDU-PLANT) ────────────────────────────────
  let plant = await prisma.plant.findFirst({
    where: { site_id: site.id, code: 'CDU-PLANT' },
  });
  if (!plant) {
    plant = await prisma.plant.create({
      data: {
        id: randomUUID(),
        organization_id: org.id,
        site_id: site.id,
        code: 'CDU-PLANT',
        name: 'Crude & Vacuum Distillation Plant',
        description: 'Atmospheric crude topping and vacuum distillation train.',
        is_active: true,
      },
    });
  }
  console.log(`✅ Plant: ${plant.name} (${plant.code})`);

  // ── 6. Operational Areas ─────────────────────────────────────────
  const areasData = [
    { code: 'CDU-AREA', name: 'Crude Distillation Area' },
    { code: 'VDU-AREA', name: 'Vacuum Distillation Area' },
  ];
  const areaMap = new Map<string, string>();

  for (const a of areasData) {
    let area = await prisma.area.findFirst({
      where: { plant_id: plant.id, code: a.code },
    });
    if (!area) {
      area = await prisma.area.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          site_id: site.id,
          plant_id: plant.id,
          code: a.code,
          name: a.name,
          is_active: true,
        },
      });
    }
    areaMap.set(a.code, area.id);
  }
  console.log(`✅ Areas registered: ${areaMap.size}`);

  // ── 7. Operating Units ───────────────────────────────────────────
  const unitsData = [
    { code: 'CDU-1', name: 'Atmospheric Crude Distillation Unit', areaCode: 'CDU-AREA' },
    { code: 'VDU-1', name: 'Vacuum Distillation Unit', areaCode: 'VDU-AREA' },
    { code: 'FCCU-1', name: 'Fluid Catalytic Cracking Unit', areaCode: 'CDU-AREA' },
  ];
  const unitMap = new Map<string, string>();

  for (const u of unitsData) {
    let unit = await prisma.unit.findFirst({
      where: { plant_id: plant.id, code: u.code },
    });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          site_id: site.id,
          plant_id: plant.id,
          area_id: areaMap.get(u.areaCode),
          code: u.code,
          name: u.name,
          is_active: true,
        },
      });
    }
    unitMap.set(u.code, unit.id);
  }
  console.log(`✅ Units registered: ${unitMap.size}`);

  // ── 8. Process Systems ───────────────────────────────────────────
  const systemsData = [
    { code: 'CDU-PHT', name: 'Crude Preheat Train', unitCode: 'CDU-1' },
    { code: 'CDU-ATM', name: 'Atmospheric Column System', unitCode: 'CDU-1' },
    { code: 'CDU-DES', name: 'Desalter Package', unitCode: 'CDU-1' },
    { code: 'VDU-COL', name: 'Vacuum Column System', unitCode: 'VDU-1' },
  ];
  const systemMap = new Map<string, string>();

  for (const s of systemsData) {
    const unitId = unitMap.get(s.unitCode)!;
    let sys = await prisma.system.findFirst({
      where: { unit_id: unitId, code: s.code },
    });
    if (!sys) {
      sys = await prisma.system.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          site_id: site.id,
          unit_id: unitId,
          code: s.code,
          name: s.name,
          criticality: 'High',
          status: 'Active',
          is_active: true,
        },
      });
    }
    systemMap.set(s.code, sys.id);
  }
  console.log(`✅ Systems registered: ${systemMap.size}`);

  // ── 9. Critical Assets / Equipment ───────────────────────────────
  const assetsData = [
    { tag: 'E-101A', name: 'Crude Preheat Exchanger A', eqType: 'hex-st', unit: 'CDU-1', sys: 'CDU-PHT', crit: 'high' },
    { tag: 'E-101B', name: 'Crude Preheat Exchanger B', eqType: 'hex-st', unit: 'CDU-1', sys: 'CDU-PHT', crit: 'high' },
    { tag: 'P-101A', name: 'Residue Bottoms Pump A', eqType: 'pmp-cf', unit: 'CDU-1', sys: 'CDU-PHT', crit: 'critical' },
    { tag: 'P-101B', name: 'Residue Bottoms Pump B', eqType: 'pmp-cf', unit: 'CDU-1', sys: 'CDU-PHT', crit: 'high' },
    { tag: 'C-101',  name: 'Atmospheric Crude Column', eqType: 'col-ds', unit: 'CDU-1', sys: 'CDU-ATM', crit: 'critical' },
    { tag: 'C-201',  name: 'Vacuum Distillation Tower', eqType: 'col-ds', unit: 'VDU-1', sys: 'VDU-COL', crit: 'critical' },
    { tag: 'V-102',  name: 'Electrostatic Desalter Drum', eqType: 'vsl-pv', unit: 'CDU-1', sys: 'CDU-DES', crit: 'medium' },
    { tag: 'H-201',  name: 'Vacuum Feed Fired Heater', eqType: 'htr-fh', unit: 'VDU-1', sys: 'VDU-COL', crit: 'critical' },
  ];
  const assetMap = new Map<string, string>();

  for (const a of assetsData) {
    let asset = await prisma.asset.findFirst({
      where: { organization_id: org.id, tag_number: a.tag },
    });
    if (!asset) {
      asset = await prisma.asset.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          site_id: site.id,
          plant_id: plant.id,
          unit_id: unitMap.get(a.unit)!,
          system_id: systemMap.get(a.sys)!,
          tag_number: a.tag,
          name: a.name,
          equipment_type_id: a.eqType,
          status: 'in_service',
          criticality: a.crit as any,
          is_active: true,
        },
      });
    }
    assetMap.set(a.tag, asset.id);
  }
  console.log(`✅ Assets registered in plant topology: ${assetMap.size}`);

  // ── 10. Turnaround Contractors ───────────────────────────────────
  const contractorsData = [
    { code: 'APEX-MECH', name: 'Apex Mechanical Overhauls & Piping BV' },
    { code: 'GLOBE-ELEC', name: 'Globe Electrical & Instrumentation NV' },
    { code: 'SAFE-SCAF', name: 'SafeAccess Industrial Scaffolding Group' },
    { code: 'INSPECT-NDT', name: 'EuroTech NDT & Metallurgy Services' },
  ];
  const contractorMap = new Map<string, string>();

  for (const c of contractorsData) {
    let contractor = await prisma.contractor.findFirst({
      where: { organization_id: org.id, code: c.code },
    });
    if (!contractor) {
      contractor = await prisma.contractor.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          site_id: site.id,
          code: c.code,
          name: c.name,
          is_active: true,
        },
      });
    }
    contractorMap.set(c.code, contractor.id);
  }
  console.log(`✅ Contractors registered: ${contractorMap.size}`);

  // ── 11. Reference Turnaround Event ───────────────────────────────
  let event = await prisma.event.findFirst({
    where: { organization_id: org.id, title: 'Spring 2028 Major Turnaround' },
  });
  if (!event) {
    event = await prisma.event.create({
      data: {
        id: randomUUID(),
        organization_id: org.id,
        site_id: site.id,
        title: 'Spring 2028 Major Turnaround',
        event_type: 'turnaround',
        start_date: new Date('2028-03-01'),
        end_date: new Date('2028-04-15'),
        status: 'planning',
        is_active: true,
      },
    });
  }
  console.log(`✅ Turnaround Event: ${event.title} (${event.id})`);

  // ── 12. Governed Workpacks ───────────────────────────────────────
  // Workpack 1: E-101A Heat Exchanger Bundle Overhaul
  const wpE101A = await prisma.workpack.upsert({
    where: { workpack_id_code: 'WP-CDU-E101A-OVH' },
    update: {
      status: 'in_progress',
    },
    create: {
      id: randomUUID(),
      organization_id: org.id,
      site_id: site.id,
      plant_id: plant.id,
      unit_id: unitMap.get('CDU-1')!,
      system_id: systemMap.get('CDU-PHT')!,
      asset_id: assetMap.get('E-101A')!,
      event_id: event.id,
      discipline_id: disciplineMap.get('MECH')!,
      contractor_id: contractorMap.get('APEX-MECH')!,
      workpack_id_code: 'WP-CDU-E101A-OVH',
      workpack_number: 'WP-2028-00101',
      unit_code: 'CDU-1',
      title: 'E-101A Shell & Tube Exchanger Bundle Pullout & Overhaul',
      scope_of_work: 'Complete overhaul of crude preheat exchanger E-101A: blind isolation, head opening, bundle extraction, high-pressure jet wash, tube eddy-current NDT inspection, retubing repair, bundle reinsertion, box-up with new Camprofile gaskets, torquing and hydrostatic leak test.',
      equipment_type: 'hex-st',
      priority: 'High',
      status: 'in_progress',
      created_by: plannerUser.id,
    },
  });
  console.log(`✅ Workpack: ${wpE101A.workpack_id_code}`);

  // ── 13. Governed Activities with StandardActivityType Linkage ────
  // Map Standard Activities for HEX-ST from platform
  const satList = await prisma.standardActivityType.findMany({
    where: { equipment_type_id: 'hex-st' },
    orderBy: { sort_order: 'asc' },
  });
  const satByCode = new Map(satList.map((s) => [s.code, s]));

  // Find protected platform UDF definitions & options for classification
  const workPhaseDef = await prisma.activityUdfDefinition.findFirst({
    where: { code: 'UDF_WORK_PHASE' },
    include: { options: true },
  });
  const holdTypeDef = await prisma.activityUdfDefinition.findFirst({
    where: { code: 'UDF_HOLD_TYPE' },
    include: { options: true },
  });

  const getOptionId = (def: any, val: string) => {
    return def?.options?.find((o: any) => o.code_value === val)?.id ?? null;
  };

  const HEX_ACTIVITIES = [
    { seq: 10, num: 'ACT-E101A-01', desc: 'Operations to Maintenance Handover & Gas-Free LOTO', satCode: 'HANDOVER', hours: 4.0, phase: 'PREPARATION', hold: 'OPS_HANDOVER' },
    { seq: 20, num: 'ACT-E101A-02', desc: 'Positive Isolation Blinding on Shell & Tube Flanges', satCode: 'BLIND', hours: 8.0, phase: 'ISOLATION', hold: 'NONE' },
    { seq: 30, num: 'ACT-E101A-03', desc: 'Unbolt Channel Head and Floating Head Cover', satCode: 'BOX_OPEN', hours: 12.0, phase: 'MECHANICAL', hold: 'NONE' },
    { seq: 40, num: 'ACT-E101A-04', desc: 'Rig & Extract Tube Bundle with 50T Mobile Crane', satCode: 'BPULL', hours: 16.0, phase: 'MECHANICAL', hold: 'NONE' },
    { seq: 50, num: 'ACT-E101A-05', desc: 'High Pressure Water Jetting at Dedicated Wash Pad', satCode: 'CLEAN', hours: 16.0, phase: 'MECHANICAL', hold: 'NONE' },
    { seq: 60, num: 'ACT-E101A-06', desc: 'Eddy Current Tube NDT and Shell Thickness Inspection', satCode: 'INSP', hours: 24.0, phase: 'INSPECTION', hold: 'INSP_WITNESS' },
    { seq: 70, num: 'ACT-E101A-07', desc: 'Machining Gasket Faces and Selective Tube Plugging', satCode: 'REPAIR', hours: 40.0, phase: 'MECHANICAL', hold: 'NONE' },
    { seq: 80, num: 'ACT-E101A-08', desc: 'Reinstall Tube Bundle into Exchanger Shell', satCode: 'BINST', hours: 16.0, phase: 'BOX_UP', hold: 'NONE' },
    { seq: 90, num: 'ACT-E101A-09', desc: 'Channel Head Box-up & Calibrated Hydraulic Torquing', satCode: 'BOX_CLOSE', hours: 12.0, phase: 'BOX_UP', hold: 'TORQUE_SIGN' },
    { seq: 100, num: 'ACT-E101A-10', desc: 'Hydrostatic Shell & Tube Pressure Leak Test', satCode: 'LEAK_TEST', hours: 8.0, phase: 'PRECOMM', hold: 'LEAK_TIGHT' },
    { seq: 110, num: 'ACT-E101A-11', desc: 'De-blinding of Process Lines and Reinstatement', satCode: 'DEBLIND', hours: 8.0, phase: 'PRECOMM', hold: 'OPS_HANDOVER' },
  ];

  for (const act of HEX_ACTIVITIES) {
    const sat = satByCode.get(act.satCode);
    let existingAct = await prisma.activity.findFirst({
      where: { organization_id: org.id, activity_number: act.num },
    });

    if (!existingAct) {
      existingAct = await prisma.activity.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          site_id: site.id,
          workpack_id: wpE101A.id,
          event_id: event.id,
          activity_number: act.num,
          sequence_number: act.seq,
          description: act.desc,
          discipline_id: disciplineMap.get('MECH')!,
          duration_hours: act.hours,
          status: 'ready',
          standard_activity_type_id: sat?.id ?? null,
          created_by: plannerUser.id,
        },
      });

      // Save controlled UDF values
      if (workPhaseDef) {
        const phaseOptId = getOptionId(workPhaseDef, act.phase);
        if (phaseOptId) {
          await prisma.activityUdfValue.create({
            data: {
              id: randomUUID(),
              organization_id: org.id,
              activity_id: existingAct.id,
              udf_definition_id: workPhaseDef.id,
              udf_option_id: phaseOptId,
            },
          });
        }
      }

      if (holdTypeDef) {
        const holdOptId = getOptionId(holdTypeDef, act.hold);
        if (holdOptId) {
          await prisma.activityUdfValue.create({
            data: {
              id: randomUUID(),
              organization_id: org.id,
              activity_id: existingAct.id,
              udf_definition_id: holdTypeDef.id,
              udf_option_id: holdOptId,
            },
          });
        }
      }
    }
  }
  console.log(`✅ Governed Activities seeded for ${wpE101A.workpack_id_code}: ${HEX_ACTIVITIES.length}`);

  console.log('\n======================================================');
  console.log('🏁 VALIDATION PLANT SEED COMPLETE & GREEN');
  console.log('======================================================\n');
}

function getDisciplineColor(code: string): string {
  const colors: Record<string, string> = {
    MECH: '#3B82F6',
    ELEC: '#F59E0B',
    INST: '#10B981',
    CIVL: '#6366F1',
    INSP: '#8B5CF6',
    SCAF: '#EC4899',
    PNT: '#14B8A6',
    INSUL: '#F97316',
    CLN: '#06B6D4',
    QAQC: '#EF4444',
  };
  return colors[code] || '#6B7280';
}

if (require.main === module) {
  runValidationPlantSeed()
    .then(() => disconnect())
    .catch((err) => {
      console.error('❌ Validation Plant Seed failed:', err);
      process.exit(1);
    });
}
