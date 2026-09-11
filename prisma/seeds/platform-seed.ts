/**
 * PLATFORM SEED FOUNDATION
 * Syority Turnaround Management Platform
 * 
 * Version: 1.3.0
 * Status: APPROVED ARCHITECTURE
 * 
 * Non-Negotiable Governance Principles:
 * 1. SEED DATA IS RECOMMENDATION/DEFAULT INTELLIGENCE ONLY.
 *    It must never become a mandatory restriction unless an explicit tenant business rule marks a value mandatory.
 * 2. Equipment Type -> Standard Activities -> Activity Code -> Discipline -> Phase -> Defaults.
 * 3. The Triad: SUGGESTED VALUE, SELECTED VALUE, ENFORCED VALUE.
 * 4. UDF Rule: TEXT UDFs are permitted ONLY for genuine narrative notes.
 *    All classification/filtering/reporting UDFs MUST be DROPDOWN or MULTI_SELECT.
 * 5. Strictly idempotent and safe to re-run without destroying tenant customizations.
 */

import { prisma, disconnect } from '../seed-client';
import { randomUUID } from 'crypto';
import { DISCIPLINES, buildActivityCodes } from '../demo/activityCodes';
import { buildEquipmentTypes } from '../demo/equipmentTypes';

export async function runPlatformSeed() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PLATFORM SEED FOUNDATION (v1.3.0)...');
  console.log('======================================================\n');

  // ── 1. Ensure Platform Organization ──────────────────────────────
  const platformOrg = await prisma.organization.upsert({
    where: { slug: 'syority-platform' },
    update: {
      name: 'SYORITY Platform Master',
      is_active: true,
      deployment_model: 'platform',
      plan_tier: 'platform',
      status: 'active',
    },
    create: {
      id: randomUUID(),
      name: 'SYORITY Platform Master',
      slug: 'syority-platform',
      industry: 'Oil & Gas / Petrochemicals',
      country: 'Belgium',
      timezone: 'Europe/Brussels',
      is_active: true,
      deployment_model: 'platform',
      plan_tier: 'platform',
      status: 'active',
      notes: 'Authoritative platform master repository and seed library.',
      updated_at: new Date(),
    },
  });
  console.log(`✅ Platform Organization: ${platformOrg.name} (${platformOrg.id})`);

  // ── 2. Global Disciplines (10 Industrial Disciplines) ─────────────
  console.log('🌱 Seeding 10 Global Industrial Disciplines...');
  const disciplineMap = new Map<string, string>(); // code -> id

  for (const d of DISCIPLINES) {
    const existing = await prisma.discipline.findFirst({
      where: { organization_id: platformOrg.id, code: d.code },
    });

    if (existing) {
      disciplineMap.set(d.code, existing.id);
    } else {
      const created = await prisma.discipline.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrg.id,
          name: d.name,
          code: d.code,
          color: getDisciplineColor(d.code),
          is_active: true,
          updated_at: new Date(),
        },
      });
      disciplineMap.set(d.code, created.id);
    }
  }
  console.log(`✅ Disciplines registered: ${disciplineMap.size}`);

  // ── 3. Equipment Types (50+ Refining Types) ───────────────────────
  console.log('🌱 Seeding 50+ Refining Equipment Types...');
  const equipmentTypeMap = new Map<string, string>(); // code -> id
  const eqTypes = buildEquipmentTypes();

  for (const et of eqTypes) {
    const existing = await prisma.equipmentType.findFirst({
      where: { org_id: platformOrg.id, code: et.code },
    });

    if (existing) {
      equipmentTypeMap.set(et.code, existing.id);
    } else {
      const id = et.code.toLowerCase();
      const created = await prisma.equipmentType.create({
        data: {
          id,
          org_id: platformOrg.id,
          name: et.name,
          code: et.code,
          description: et.description,
          is_active: true,
        },
      });
      equipmentTypeMap.set(et.code, created.id);
    }
  }
  console.log(`✅ Equipment types registered: ${equipmentTypeMap.size}`);

  // ── 4. Standard Activity Types (Mapped Recommendation Packages) ──
  console.log('🌱 Seeding Standard Activity Type Recommendation Packages...');
  
  // High-fidelity standard activity recommendation matrix
  // [eqCode, actCode, actName, description, typicalHours, sortOrder]
  const RECOMMENDATION_MATRIX: [string, string, string, string, number, number][] = [
    // Shell & Tube Heat Exchanger (HEX-ST) — Exact 9 Core Steps + Pre/Post
    ['HEX-ST', 'HANDOVER',   'Handover',         'Operations to Maintenance Handover & LOTO',         4.0,  5],
    ['HEX-ST', 'BLIND',      'Blinding',         'Install positive isolation blinds on nozzles',      8.0,  10],
    ['HEX-ST', 'BOX_OPEN',   'Opening',          'Remove channel head and shell cover',              12.0,  20],
    ['HEX-ST', 'BPULL',      'Bundle Pullout',   'Extract tube bundle with bundle extractor',        16.0,  30],
    ['HEX-ST', 'CLEAN',      'Cleaning',         'High-pressure water jet cleaning of tube bundle',  16.0,  40],
    ['HEX-ST', 'INSP',       'Inspection',       'Eddy current, ultrasonic and visual inspection',   24.0,  50],
    ['HEX-ST', 'REPAIR',     'Repair',           'Tube plugging, retubing, or gasket face machining', 40.0, 60],
    ['HEX-ST', 'BINST',      'Bundle Insertion', 'Reinstall tube bundle into exchanger shell',       16.0,  70],
    ['HEX-ST', 'BOX_CLOSE',  'Box-up',           'Reinstall head/cover with new gaskets and torquing',12.0, 80],
    ['HEX-ST', 'LEAK_TEST',  'Leak Test',        'Hydrostatic shell and tube side pressure testing',  8.0,  90],
    ['HEX-ST', 'DEBLIND',    'De-blinding',      'Remove blinds and restore piping connections',      8.0, 100],

    // Centrifugal Pump (PMP-CF)
    ['PMP-CF', 'HANDOVER',   'Handover',         'Process drain, de-inventory and electrical LOTO',   2.0,  5],
    ['PMP-CF', 'ISOL',       'Isolation',        'Lockout / tagout of electrical and suction/discharge', 4.0, 10],
    ['PMP-CF', 'ALIGN_CHK',  'Alignment Check',  'Pre-disassembly laser alignment verification',      4.0,  20],
    ['PMP-CF', 'DISASM',     'Disassembly',      'Casing unbolting and impeller/rotor removal',       8.0,  30],
    ['PMP-CF', 'INSP',       'Inspection',       'Internal casing, wear ring and clearance check',   12.0,  40],
    ['PMP-CF', 'BRG_REPL',   'Bearing / Seal',   'Mechanical seal and bearing assembly overhaul',     8.0,  50],
    ['PMP-CF', 'ASSEM',      'Reassembly',       'Pump reassembly and casing torque check',           8.0,  60],
    ['PMP-CF', 'ALIGN',      'Final Alignment',  'Precision laser coupling alignment to motor',       6.0,  70],
    ['PMP-CF', 'RUN_TEST',   'Run Test',         'Solo motor run and coupled vibration trial',        4.0,  80],

    // Distillation Column (COL-DS)
    ['COL-DS', 'HANDOVER',   'Handover',         'Unit steaming, gas-freeing and LOTO handover',      8.0,  5],
    ['COL-DS', 'BLIND',      'Blinding',         'Column nozzle and battery limit isolation blinds', 16.0,  10],
    ['COL-DS', 'MAN_OPEN',   'Opening',          'Open column manways from top to bottom',           12.0,  20],
    ['COL-DS', 'CLEAN',      'Cleaning',         'Chemical foam washing and high-pressure jetting',  24.0,  30],
    ['COL-DS', 'INSP',       'Inspection',       'Visual, thickness and internal tray inspection',   24.0,  40],
    ['COL-DS', 'REPAIR',     'Repair',           'Tray hardware repair and downcomer maintenance',   36.0,  50],
    ['COL-DS', 'MAN_CLOSE',  'Box-up',           'Manhole closure with new gaskets and torquing',    16.0,  60],
    ['COL-DS', 'LEAK_TEST',  'Leak Test',        'Nitrogen purging and pneumatic joint testing',     12.0,  70],
    ['COL-DS', 'DEBLIND',    'De-blinding',      'De-blinding of column nozzles and headers',        16.0,  80],

    // Pressure Vessel (VSL-PV)
    ['VSL-PV', 'HANDOVER',   'Handover',         'Depressurization, purge and handover',              4.0,  5],
    ['VSL-PV', 'BLIND',      'Blinding',         'Vessel nozzle blinding and isolation',              8.0,  10],
    ['VSL-PV', 'MAN_OPEN',   'Opening',          'Remove manway covers and install ventilation',      6.0,  20],
    ['VSL-PV', 'CLEAN',      'Cleaning',         'Internal sludge cleanout and hydroblasting',       12.0,  30],
    ['VSL-PV', 'INSP',       'Inspection',       'Internal vessel inspection and weld NDT',          16.0,  40],
    ['VSL-PV', 'REPAIR',     'Repair',           'Internal cladding repair, nozzle grind out',       24.0,  50],
    ['VSL-PV', 'MAN_CLOSE',  'Box-up',           'Manhole box-up and bolt torquing',                  8.0,  60],
    ['VSL-PV', 'LEAK_TEST',  'Leak Test',        'Pneumatic soap bubble / helium leak test',          6.0,  70],
    ['VSL-PV', 'DEBLIND',    'De-blinding',      'De-blinding and line restoration',                  8.0,  80],

    // Fired Heater (HTR-FH)
    ['HTR-FH', 'HANDOVER',   'Handover',         'Fuel gas double block & bleed LOTO handover',       8.0,  5],
    ['HTR-FH', 'BLIND',      'Blinding',         'Process coil and fuel gas positive blinding',      16.0,  10],
    ['HTR-FH', 'DOOR_OPEN',  'Opening',          'Open firebox, convection and header box doors',     6.0,  20],
    ['HTR-FH', 'CLEAN',      'Cleaning',         'Convection section steam / dry-ice cleaning',      16.0,  30],
    ['HTR-FH', 'INSP',       'Inspection',       'Radiant tube laser profilometry and API 530 NDT',  24.0,  40],
    ['HTR-FH', 'REPAIR',     'Repair',           'Refractory repair and burner tile replacement',    32.0,  50],
    ['HTR-FH', 'BOX_CLOSE',  'Box-up',           'Header box closure and firebox door sealing',       8.0,  60],
    ['HTR-FH', 'LEAK_TEST',  'Leak Test',        'Coil hydrostatic pressure testing',                16.0,  70],
    ['HTR-FH', 'DEBLIND',    'De-blinding',      'De-blinding of heater process coils',              16.0,  80],

    // Pressure Safety Valve (VLV-PSV)
    ['VLV-PSV', 'HANDOVER',  'Handover',         'Handover & field work permit clearance',            2.0,  5],
    ['VLV-PSV', 'BLIND',     'Blinding',         'Spool / nozzle blinding if header remains live',    4.0,  10],
    ['VLV-PSV', 'REMOV',     'Removal',          'Unbolt and rig PSV to valve workshop',             4.0,  20],
    ['VLV-PSV', 'TEST_PRE',  'Pre-Pop Test',     'As-received workshop pop pressure test',           2.0,  30],
    ['VLV-PSV', 'OVERHAUL',  'Overhaul',         'Lapping disc and nozzle, replace soft goods',       6.0,  40],
    ['VLV-PSV', 'TEST_POST', 'Final Pop Test',   'Cold set pressure and seat tightness verification', 2.0, 50],
    ['VLV-PSV', 'REINST',    'Reinstallation',   'Reinstall PSV with new gaskets and torque',        4.0,  60],
    ['VLV-PSV', 'SEAL_LEAD', 'Car-Seal',         'Install tamper-evident car-seal and tag',          1.0,  70],
  ];

  let satCount = 0;
  for (const [eqCode, actCode, actName, desc, hours, sort] of RECOMMENDATION_MATRIX) {
    const eqId = equipmentTypeMap.get(eqCode);
    if (!eqId) continue;

    const existing = await prisma.standardActivityType.findFirst({
      where: { equipment_type_id: eqId, code: actCode },
    });

    if (!existing) {
      await prisma.standardActivityType.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrg.id,
          equipment_type_id: eqId,
          name: actName,
          code: actCode,
          description: desc,
          is_mandatory: false, // Explicitly recommendation only, never forced
          typical_duration_hrs: hours,
          sort_order: sort,
          is_active: true,
        },
      });
      satCount++;
    }
  }
  console.log(`✅ Standard Activity recommendations registered: ${satCount}`);

  // ── 5. Activity Library Catalog (250+ Governed Activity Codes) ────
  console.log('🌱 Seeding 250+ Governed Activity Codes...');
  const rawCodes = buildActivityCodes();
  let actLibCount = 0;

  for (const a of rawCodes) {
    const existing = await prisma.activityLibrary.findFirst({
      where: { organization_id: platformOrg.id, activity_code: a.code, deleted_at: null },
    });

    if (!existing) {
      await prisma.activityLibrary.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrg.id,
          name: a.name,
          activity_code: a.code,
          description: a.description,
          duration_hours: a.duration_hours,
          discipline_id: disciplineMap.get(a.disciplineCode) || null,
          phase: a.phase,
          is_active: true,
          updated_at: new Date(),
        },
      });
      actLibCount++;
    }
  }
  console.log(`✅ Activity Codes registered in catalog: ${actLibCount}`);

  // ── 6. Protected Platform UDFs (Strict Dropdown / Multi-Select) ───
  console.log('🌱 Seeding Protected Platform System UDFs with Controlled Options...');

  interface SystemUdfSpec {
    code: string;
    name: string;
    type: 'select';
    is_mandatory: boolean;
    options: { value: string; label: string; sort_order: number }[];
  }

  const SYSTEM_UDFS: SystemUdfSpec[] = [
    {
      code: 'UDF_WORK_PHASE',
      name: 'Work Phase',
      type: 'select',
      is_mandatory: true,
      options: [
        { value: 'PREPARATION',   label: 'Preparation & Pre-turnaround', sort_order: 10 },
        { value: 'ISOLATION',     label: 'Process & Electrical Isolation (LOTO)', sort_order: 20 },
        { value: 'MECHANICAL',    label: 'Mechanical Opening & Extraction', sort_order: 30 },
        { value: 'INSPECTION',    label: 'Internal Inspection & Metallurgy NDT', sort_order: 40 },
        { value: 'BOX_UP',        label: 'Closing, Gaskets & Bolt Torquing', sort_order: 50 },
        { value: 'PRECOMM',       label: 'Pre-commissioning, Leak Test & Purge', sort_order: 60 },
        { value: 'COMMISSIONING', label: 'Plant Startup & Introduction of Feed', sort_order: 70 },
      ],
    },
    {
      code: 'UDF_SHUTDOWN_PHASE',
      name: 'Shutdown Execution Phase',
      type: 'select',
      is_mandatory: false,
      options: [
        { value: 'PRE_SD',       label: 'Pre-Shutdown Window', sort_order: 10 },
        { value: 'SHUTDOWN',     label: 'De-inventorying & Steaming Out', sort_order: 20 },
        { value: 'T_ZERO',       label: 'T-Zero Blinding Window', sort_order: 30 },
        { value: 'PEAK_EXEC',    label: 'Peak Mechanical Window', sort_order: 40 },
        { value: 'DE_ISOLATION', label: 'De-isolation Window', sort_order: 50 },
        { value: 'STARTUP',      label: 'On-stream Oil-in Window', sort_order: 60 },
      ],
    },
    {
      code: 'UDF_HOLD_TYPE',
      name: 'Quality Hold Point',
      type: 'select',
      is_mandatory: false,
      options: [
        { value: 'NONE',         label: 'None (Standard Execution)', sort_order: 10 },
        { value: 'OPS_HANDOVER', label: 'Operations Release Hold Point', sort_order: 20 },
        { value: 'INSP_WITNESS', label: 'Owner QA/QC Inspection Witness', sort_order: 30 },
        { value: 'STATUTORY_AI', label: 'Third-Party Statutory Inspector (AIB)', sort_order: 40 },
        { value: 'TORQUE_SIGN',  label: 'Calibrated Flange Bolt Torquing Sign-off', sort_order: 50 },
        { value: 'LEAK_TIGHT',   label: 'Joint Integrity Leak Test Verification', sort_order: 60 },
      ],
    },
    {
      code: 'UDF_SAFETY_CATEGORY',
      name: 'Safety & Permit Classification',
      type: 'select',
      is_mandatory: false,
      options: [
        { value: 'COLD_WORK',     label: 'Standard Cold Work Permit', sort_order: 10 },
        { value: 'HOT_WORK_CAT1', label: 'Class 1 Hot Work (Grinding/Sparks)', sort_order: 20 },
        { value: 'HOT_WORK_CAT2', label: 'Class 2 Hot Work (Open Arc Welding)', sort_order: 30 },
        { value: 'CONFINED_SPACE',label: 'Confined Space Entry with Breathing Air', sort_order: 40 },
        { value: 'CRITICAL_LIFT', label: 'Critical Crane Lift Over Live Equipment', sort_order: 50 },
        { value: 'RADIOGRAPHY',   label: 'Gamma Radiography NDE Testing', sort_order: 60 },
      ],
    },
  ];

  for (const udf of SYSTEM_UDFS) {
    let def = await prisma.activityUdfDefinition.findFirst({
      where: { organization_id: platformOrg.id, code: udf.code },
    });

    if (!def) {
      def = await prisma.activityUdfDefinition.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrg.id,
          name: udf.name,
          code: udf.code,
          type: udf.type,
          is_mandatory: udf.is_mandatory,
          is_active: true,
          is_filterable: true,
          is_sortable: true,
          is_groupable: true,
          is_bulk_editable: true,
          display_order: 10,
          updated_at: new Date(),
        },
      });
    }

    // Seed options
    for (const opt of udf.options) {
      const existingOpt = await prisma.activityUdfOption.findFirst({
        where: { udf_definition_id: def.id, code_value: opt.value },
      });

      if (!existingOpt) {
        await prisma.activityUdfOption.create({
          data: {
            id: randomUUID(),
            organization_id: platformOrg.id,
            udf_definition_id: def.id,
            value: opt.value,
            label: opt.label,
            code_value: opt.value,
            sort_order: opt.sort_order,
            is_active: true,
            updated_at: new Date(),
          },
        });
      }
    }
  }
  console.log(`✅ System UDFs and controlled options registered: ${SYSTEM_UDFS.length}`);

  console.log('\n======================================================');
  console.log('🏁 PLATFORM SEED FOUNDATION COMPLETE & GREEN');
  console.log('======================================================\n');
}

function getDisciplineColor(code: string): string {
  const colors: Record<string, string> = {
    MECH: '#3B82F6', // Blue
    ELEC: '#F59E0B', // Amber
    INST: '#10B981', // Emerald
    CIVL: '#6366F1', // Indigo
    INSP: '#8B5CF6', // Purple
    SCAF: '#EC4899', // Pink
    PNT: '#14B8A6',  // Teal
    INSUL: '#F97316',// Orange
    CLN: '#06B6D4',  // Cyan
    QAQC: '#EF4444', // Red
  };
  return colors[code] || '#6B7280';
}

if (require.main === module) {
  runPlatformSeed()
    .then(() => disconnect())
    .catch((err) => {
      console.error('❌ Platform Seed failed:', err);
      process.exit(1);
    });
}
