/**
 * M8.13 Phase 1 — Standard Activity Type Seed Data
 *
 * Seeds standard activity types for common turnaround equipment types.
 * Links to existing EquipmentType records by code.
 *
 * Run with: npx ts-node prisma/demo/seedStandardActivityTypes.ts
 */
import { randomUUID } from 'crypto';

/**
 * Standard activity types by equipment type code.
 * Each array entry: [code, name, description, is_mandatory, typical_duration_hrs, sort_order]
 */
export const STANDARD_ACTIVITY_TYPES: Record<
  string,
  [string, string, string, boolean, number | null, number][]
> = {
  // Shell & Tube Heat Exchanger (HEX-ST)
  'HEX-ST': [
    ['BLIND',      'Blinding',          'Install blinds on nozzles for isolation',          true,  8,   10],
    ['BOX_OPEN',   'Box Opening',       'Remove head/cover for bundle access',              true,  12,  20],
    ['BPULL',      'Bundle Pullout',    'Extract tube bundle for inspection/cleaning',      true,  16,  30],
    ['INSP',       'Inspection',        'NDE and visual inspection of shell and bundle',    true,  24,  40],
    ['CLEAN',      'Cleaning',          'Hydroblasting / chemical cleaning of bundle',      true,  16,  50],
    ['REPAIR',     'Repair / Retube',   'Tube plugging, retubing, gasket replacement',      false, 40,  60],
    ['BINST',      'Bundle Install',    'Reinstall tube bundle into shell',                 true,  16,  70],
    ['BOX_CLOSE',  'Box Closing',       'Reinstall head/cover and torque bolting',          true,  12,  80],
    ['LEAK_TEST',  'Leak Test',         'Hydrostatic or pneumatic leak testing',            true,  8,   90],
    ['DEBLIND',    'De-blinding',       'Remove blinds and restore process connections',    true,  8,   100],
  ],

  // Pressure Vessel (VSL-PV)
  'VSL-PV': [
    ['BLIND',      'Blinding',          'Install blinds for isolation',                     true,  8,   10],
    ['OPEN',       'Opening',           'Remove manway covers or flanged openings',         true,  12,  20],
    ['INSP',       'Inspection',        'Internal/external inspection and NDE',             true,  24,  30],
    ['CLEAN',      'Cleaning',          'Internal cleaning of vessel',                      true,  12,  40],
    ['INT_WORK',   'Internal Work',     'Internal repairs, nozzle weld buildup, lining',    false, 40,  50],
    ['CLOSE',      'Closing',           'Reinstall manway covers, torque bolting',          true,  12,  60],
    ['LEAK_TEST',  'Leak Test',         'Hydrostatic or pneumatic test',                    true,  8,   70],
    ['DEBLIND',    'De-blinding',       'Remove blinds and restore connections',            true,  8,   80],
  ],

  // Distillation Column (COL-DS)
  'COL-DS': [
    ['BLIND',      'Blinding',          'Install blinds for column isolation',              true,  12,  10],
    ['OPEN',       'Opening',           'Remove manways and tray-access openings',          true,  16,  20],
    ['INSP',       'Inspection',        'Column shell, tray, packing inspection',           true,  32,  30],
    ['INT_WORK',   'Internal Work',     'Tray repairs, packing replacement, downcomers',    false, 80,  40],
    ['TRAY_REPL',  'Tray Replacement',  'Remove and install column trays',                 false, 120, 50],
    ['CLOSE',      'Closing',           'Reinstall manways, torque bolting',                true,  16,  60],
    ['LEAK_TEST',  'Leak Test',         'Tray testing, hydro test',                         true,  12,  70],
    ['DEBLIND',    'De-blinding',       'Remove blinds and restore connections',            true,  12,  80],
  ],

  // Centrifugal Pump (PMP-CF)
  'PMP-CF': [
    ['ISOL',       'Isolation',         'Electrical and mechanical isolation',              true,  4,   10],
    ['ALIGN_CHK',  'Alignment Check',   'Pre-disassembly alignment check and recording',   true,  4,   20],
    ['DISASM',     'Disassembly',       'Pump disassembly and parts tagging',               true,  8,   30],
    ['INSP',       'Inspection',        'Component inspection and wear measurement',        true,  12,  40],
    ['BRG_REPL',   'Bearing Replace',   'Bearing and seal replacement',                    false, 8,   50],
    ['ASSEM',      'Assembly',          'Pump reassembly with new seals/bearings',          true,  8,   60],
    ['ALIGN',      'Alignment',         'Final shaft alignment',                           true,  6,   70],
    ['RUN_TEST',   'Run Test',          'Uncoupled and coupled run tests',                 true,  4,   80],
  ],

  // PSV / PRV (VLV-PSV)
  'VLV-PSV': [
    ['REMOVE',     'Removal',           'Remove PSV from process line',                    true,  4,   10],
    ['WS_TEST',    'Workshop Test',     'Bench test at workshop / as-found test',          true,  4,   20],
    ['REPAIR',     'Repair',            'Lapping, spring replacement, trim overhaul',      false, 8,   30],
    ['SET_TEST',   'Set/Reset Test',    'Set pressure and seal leak test',                 true,  4,   40],
    ['REINSTALL',  'Reinstallation',    'Reinstall PSV to process line',                   true,  4,   50],
    ['IN_SITU',    'In-situ Test',      'In-line pop test or inline system check',         false, 2,   60],
  ],

  // Centrifugal Compressor (CMP-CC)
  'CMP-CC': [
    ['ISOL',       'Isolation',         'Electrical and mechanical isolation',              true,  8,   10],
    ['OPEN',       'Opening',           'Casing opening (upper half removal)',              true,  24,  20],
    ['INSP',       'Inspection',        'Rotor, bearing, seal, labyrinth inspection',      true,  32,  30],
    ['OVERHAUL',   'Overhaul',          'Full overhaul including rotor, seals, bearings',  false, 120, 40],
    ['ASSEM',      'Assembly',          'Casing closing and torque bolting',                true,  24,  50],
    ['ALIGN',      'Alignment',         'Train alignment and coupling installation',       true,  12,  60],
    ['RUN_TEST',   'Run Test',          'Solo run and performance test',                   true,  8,   70],
  ],

  // Fired Heater (HTR-FH)
  'HTR-FH': [
    ['BLIND',      'Blinding',          'Process and fuel gas isolation',                   true,  12,  10],
    ['OPEN',       'Opening',           'Open heater access doors and peep holes',         true,  8,   20],
    ['INSP',       'Inspection',        'Tube inspection, refractory, firebox',            true,  40,  30],
    ['TUBE_REPL',  'Tube Replacement',  'Replace damaged tubes / return bends',            false, 80,  40],
    ['REFRACT',    'Refractory Repair', 'Patch or reline refractory',                      false, 60,  50],
    ['CLOSE',      'Closing',           'Close access doors, reinstall burners',           true,  8,   60],
    ['DEBLIND',    'De-blinding',       'Remove blinds and restore connections',            true,  12,  70],
  ],
};

/**
 * Build seed data for insertion.
 * Returns flat array of records ready for prisma.standardActivityType.create.
 */
export function buildStandardActivityTypeSeed(
  equipmentTypeIdByCode: Map<string, string>,
  organizationId?: string
): Array<{
  id: string;
  organization_id: string | null;
  equipment_type_id: string;
  name: string;
  code: string;
  description: string;
  is_mandatory: boolean;
  typical_duration_hrs: number | null;
  sort_order: number;
  is_active: boolean;
}> {
  const records: ReturnType<typeof buildStandardActivityTypeSeed> = [];

  for (const [eqCode, activities] of Object.entries(STANDARD_ACTIVITY_TYPES)) {
    const eqId = equipmentTypeIdByCode.get(eqCode);
    if (!eqId) continue; // Skip if equipment type not found

    for (const [code, name, description, is_mandatory, dur, sort] of activities) {
      records.push({
        id: randomUUID(),
        organization_id: organizationId ?? null,
        equipment_type_id: eqId,
        name,
        code,
        description,
        is_mandatory,
        typical_duration_hrs: dur,
        sort_order: sort,
        is_active: true,
      });
    }
  }

  return records;
}
