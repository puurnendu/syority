export type DemoTemplate = {
  name: string;
  equipment_type: string;
  job_type: string;
  description: string;
  activities: { description: string; activity_code: string; duration_hours: number; hold_point_type?: string }[];
  keywords: string[];
  shutdown_type: string;
  failure_mode: string;
};

export const WORKPACK_TEMPLATES: DemoTemplate[] = [
  {
    name: 'API 610 Centrifugal Pump Overhaul',
    equipment_type: 'Centrifugal Pump',
    job_type: 'Major Overhaul',
    description: 'Complete strip, inspect, and rebuild of API 610 process pump including seal and bearings.',
    keywords: ['pump', 'API610', 'seal', 'bearing', 'alignment'],
    shutdown_type: 'Turnaround',
    failure_mode: 'Seal leakage / high vibration',
    activities: [
      { description: 'Isolate, drain and LOTO pump circuit', activity_code: 'ACT-MECH-0001', duration_hours: 4, hold_point_type: 'Hold' },
      { description: 'Remove coupling and uncouple driver', activity_code: 'ACT-MECH-0002', duration_hours: 3 },
      { description: 'Pull rotating element and inspect', activity_code: 'ACT-MECH-0003', duration_hours: 8, hold_point_type: 'Witness' },
      { description: 'Replace bearings and mechanical seal', activity_code: 'ACT-MECH-0004', duration_hours: 10 },
      { description: 'Reassemble, align and couple', activity_code: 'ACT-MECH-0005', duration_hours: 8, hold_point_type: 'Hold' },
      { description: 'Commission and vibration baseline', activity_code: 'ACT-MECH-0006', duration_hours: 4 },
    ],
  },
  {
    name: 'Control Valve Maintenance',
    equipment_type: 'Control Valve',
    job_type: 'Maintenance',
    description: 'Overhaul control valve, calibrate positioner, and stroke-test on air.',
    keywords: ['control valve', 'positioner', 'stroke'],
    shutdown_type: 'Turnaround',
    failure_mode: 'Sticking / poor control',
    activities: [
      { description: 'Isolate and depressurize valve', activity_code: 'ACT-INST-0001', duration_hours: 2, hold_point_type: 'Hold' },
      { description: 'Remove actuator and inspect trim', activity_code: 'ACT-INST-0002', duration_hours: 6 },
      { description: 'Replace packing and soft goods', activity_code: 'ACT-INST-0003', duration_hours: 4 },
      { description: 'Calibrate positioner and stroke test', activity_code: 'ACT-INST-0004', duration_hours: 3, hold_point_type: 'Witness' },
      { description: 'Reinstall and loop check', activity_code: 'ACT-INST-0005', duration_hours: 3 },
    ],
  },
  {
    name: 'Heat Exchanger Bundle Pulling',
    equipment_type: 'Shell & Tube Heat Exchanger',
    job_type: 'Bundle Pull',
    description: 'Pull, clean, inspect, and reinsert shell-and-tube bundle with hydrotest.',
    keywords: ['exchanger', 'bundle', 'hydrotest', 'TEMA'],
    shutdown_type: 'Turnaround',
    failure_mode: 'Fouling / tube leak',
    activities: [
      { description: 'Blind and drain exchanger', activity_code: 'ACT-MECH-0010', duration_hours: 6, hold_point_type: 'Hold' },
      { description: 'Unbolt channel and pull bundle', activity_code: 'ACT-MECH-0011', duration_hours: 12 },
      { description: 'HP jet clean tubes and shell', activity_code: 'ACT-CLN-0001', duration_hours: 16 },
      { description: 'Tube inspection (UT/visual)', activity_code: 'ACT-INSP-0001', duration_hours: 8, hold_point_type: 'Witness' },
      { description: 'Insert bundle and box-up', activity_code: 'ACT-MECH-0012', duration_hours: 12, hold_point_type: 'Hold' },
      { description: 'Hydrotest to design pressure', activity_code: 'ACT-MECH-0013', duration_hours: 6, hold_point_type: 'Hold' },
    ],
  },
  {
    name: 'PSV Calibration and Recertification',
    equipment_type: 'PSV / PRV',
    job_type: 'Calibration',
    description: 'Remove PSV, bench test/set, and reinstall with new gaskets.',
    keywords: ['PSV', 'relief', 'calibration'],
    shutdown_type: 'Turnaround',
    failure_mode: 'Set-point drift',
    activities: [
      { description: 'Isolate and remove PSV', activity_code: 'ACT-MECH-0020', duration_hours: 3, hold_point_type: 'Hold' },
      { description: 'Bench test and adjust set pressure', activity_code: 'ACT-INSP-0010', duration_hours: 4, hold_point_type: 'Witness' },
      { description: 'Install with certified gaskets', activity_code: 'ACT-MECH-0021', duration_hours: 3, hold_point_type: 'Hold' },
    ],
  },
  {
    name: 'Centrifugal Compressor Inspection',
    equipment_type: 'Centrifugal Compressor',
    job_type: 'Inspection',
    description: 'Open inspection of compressor internals, bearings, and seals.',
    keywords: ['compressor', 'API617', 'bearings'],
    shutdown_type: 'Turnaround',
    failure_mode: 'High vibration',
    activities: [
      { description: 'Depressurize and purge compressor', activity_code: 'ACT-MECH-0030', duration_hours: 8, hold_point_type: 'Hold' },
      { description: 'Open casing and inspect rotor', activity_code: 'ACT-MECH-0031', duration_hours: 16, hold_point_type: 'Witness' },
      { description: 'Inspect bearings and seals', activity_code: 'ACT-MECH-0032', duration_hours: 10 },
      { description: 'Close-up and alignment check', activity_code: 'ACT-MECH-0033', duration_hours: 12, hold_point_type: 'Hold' },
    ],
  },
  {
    name: 'Air Cooler Fin Cleaning',
    equipment_type: 'Air Cooler / Fin Fan',
    job_type: 'Cleaning',
    description: 'Clean air-side fins, inspect fans and belts, restore draft.',
    keywords: ['air cooler', 'fin fan', 'cleaning'],
    shutdown_type: 'Opportunity',
    failure_mode: 'Reduced heat transfer',
    activities: [
      { description: 'Isolate fans and LOTO', activity_code: 'ACT-ELEC-0001', duration_hours: 2, hold_point_type: 'Hold' },
      { description: 'HP wash fins and headers', activity_code: 'ACT-CLN-0010', duration_hours: 10 },
      { description: 'Inspect belts, bearings, blades', activity_code: 'ACT-MECH-0040', duration_hours: 6 },
      { description: 'Restore power and run test', activity_code: 'ACT-ELEC-0002', duration_hours: 3 },
    ],
  },
  {
    name: 'Column Internal Inspection',
    equipment_type: 'Distillation Column',
    job_type: 'Internal Inspection',
    description: 'Manway entry, tray/packing inspection, and repair punch list.',
    keywords: ['column', 'trays', 'confined space'],
    shutdown_type: 'Turnaround',
    failure_mode: 'Tray damage / fouling',
    activities: [
      { description: 'Gas free and CSE permit', activity_code: 'ACT-CLN-0020', duration_hours: 8, hold_point_type: 'Hold' },
      { description: 'Erect internal scaffold', activity_code: 'ACT-SCAF-0001', duration_hours: 12 },
      { description: 'Inspect trays / packing', activity_code: 'ACT-INSP-0020', duration_hours: 16, hold_point_type: 'Witness' },
      { description: 'Repair damaged trays', activity_code: 'ACT-MECH-0050', duration_hours: 24 },
      { description: 'Final clearance and box-up', activity_code: 'ACT-QAQC-0001', duration_hours: 6, hold_point_type: 'Hold' },
    ],
  },
  {
    name: 'Motor Replacement',
    equipment_type: 'Induction Motor',
    job_type: 'Replacement',
    description: 'Replace MV/LV motor, align, megger, and no-load run.',
    keywords: ['motor', 'alignment', 'megger'],
    shutdown_type: 'Breakdown',
    failure_mode: 'Winding failure',
    activities: [
      { description: 'Electrical LOTO and cable disconnect', activity_code: 'ACT-ELEC-0010', duration_hours: 4, hold_point_type: 'Hold' },
      { description: 'Uncouple and remove motor', activity_code: 'ACT-MECH-0060', duration_hours: 6 },
      { description: 'Install new motor and align', activity_code: 'ACT-MECH-0061', duration_hours: 8, hold_point_type: 'Witness' },
      { description: 'Megger, connect, no-load run', activity_code: 'ACT-ELEC-0011', duration_hours: 4, hold_point_type: 'Hold' },
    ],
  },
  {
    name: 'Gate Valve Overhaul',
    equipment_type: 'Gate Valve',
    job_type: 'Overhaul',
    description: 'Overhaul process gate valve seats, stem, and packing.',
    keywords: ['gate valve', 'packing', 'seat'],
    shutdown_type: 'Turnaround',
    failure_mode: 'Passing valve',
    activities: [
      { description: 'Isolate and remove valve', activity_code: 'ACT-MECH-0070', duration_hours: 4, hold_point_type: 'Hold' },
      { description: 'Machine seats and lap', activity_code: 'ACT-MECH-0071', duration_hours: 8 },
      { description: 'Repack and assemble', activity_code: 'ACT-MECH-0072', duration_hours: 4 },
      { description: 'Install and leak test', activity_code: 'ACT-MECH-0073', duration_hours: 3, hold_point_type: 'Witness' },
    ],
  },
  {
    name: 'Blind Installation Campaign',
    equipment_type: 'Blind / Spacer',
    job_type: 'Isolation',
    description: 'Install spectacle blinds per isolation plan for unit entry.',
    keywords: ['blind', 'isolation', 'LOTO'],
    shutdown_type: 'Turnaround',
    failure_mode: 'N/A — planned isolation',
    activities: [
      { description: 'Verify isolation list vs P&ID', activity_code: 'ACT-QAQC-0010', duration_hours: 4, hold_point_type: 'Hold' },
      { description: 'Install blinds and update register', activity_code: 'ACT-MECH-0080', duration_hours: 12 },
      { description: 'QA walkdown of blind register', activity_code: 'ACT-QAQC-0011', duration_hours: 4, hold_point_type: 'Witness' },
    ],
  },
];

/** Expand to ≥40 unique equipment_type + job_type pairs */
const EXTRA_JOBS = [
  'Minor Overhaul',
  'Seal Replacement',
  'Bearing Change',
  'Cleaning',
  'Inspection',
  'Calibration',
  'Replacement',
  'Repair',
  'Retubing',
  'Catalyst Change',
  'Steam Leak Repair',
  'Insulation Renew',
  'Painting Touch-up',
  'Foundation Grout',
  'Alignment Check',
];

const EXTRA_EQUIP = [
  'Positive Displacement Pump',
  'Ball Valve',
  'Butterfly Valve',
  'Plate Heat Exchanger',
  'Reciprocating Compressor',
  'Pressure Vessel',
  'Storage Tank',
  'Fired Heater',
  'Boiler',
  'Cooling Tower Cell',
  'Transmitter',
  'Analyzer',
  'Filter / Strainer',
  'Steam Trap',
  'Transformer',
  'Switchgear',
  'Absorber / Stripper',
  'Reactor',
  'Blower',
  'Canned Motor Pump',
];

export function buildAllTemplates(): DemoTemplate[] {
  const out = [...WORKPACK_TEMPLATES];
  let i = 0;
  while (out.length < 42) {
    const equip = EXTRA_EQUIP[i % EXTRA_EQUIP.length];
    const job = EXTRA_JOBS[i % EXTRA_JOBS.length];
    // ensure unique pair
    if (out.some((t) => t.equipment_type === equip && t.job_type === job)) {
      i++;
      continue;
    }
    out.push({
      name: `${equip} — ${job}`,
      equipment_type: equip,
      job_type: job,
      description: `Standard turnaround methodology for ${equip.toLowerCase()} ${job.toLowerCase()}.`,
      keywords: [equip.split(' ')[0].toLowerCase(), job.toLowerCase(), 'turnaround'],
      shutdown_type: i % 4 === 0 ? 'Opportunity' : 'Turnaround',
      failure_mode: i % 3 === 0 ? 'Wear' : 'Fouling / leakage',
      activities: [
        { description: `Prepare and isolate ${equip}`, activity_code: `ACT-MECH-${String(100 + i).padStart(4, '0')}`, duration_hours: 4, hold_point_type: 'Hold' },
        { description: `Execute ${job}`, activity_code: `ACT-MECH-${String(200 + i).padStart(4, '0')}`, duration_hours: 8 },
        { description: 'QA/QC clearance and box-up', activity_code: `ACT-QAQC-${String(50 + i).padStart(4, '0')}`, duration_hours: 3, hold_point_type: 'Witness' },
      ],
    });
    i++;
  }
  return out;
}
