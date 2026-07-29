/**
 * Seed: Work Type Master — structured work classification taxonomy.
 * Per ADR-0012: Workpack Templates are the only reusable execution object.
 * Work Types provide structured categorization for templates, reports and analytics.
 *
 * Usage: import { seedWorkTypes } from './seeds/work-types';
 *        await seedWorkTypes(prisma, organizationId);
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const WORK_TYPES: Array<{ category: string; name: string; code: string; description: string }> = [
  // ── Mechanical ────────────────────────────────────────────────────────────
  { category: 'Mechanical', name: 'Bundle Pulling', code: 'MECH-BP', description: 'Extract tube bundle from shell for inspection or maintenance' },
  { category: 'Mechanical', name: 'Bundle Replacement', code: 'MECH-BR', description: 'Full tube bundle replacement' },
  { category: 'Mechanical', name: 'Retubing', code: 'MECH-RT', description: 'Replace individual tubes within a bundle' },
  { category: 'Mechanical', name: 'Tube Plugging', code: 'MECH-TP', description: 'Plug leaking or failed tubes' },
  { category: 'Mechanical', name: 'Hydro Jet Cleaning', code: 'MECH-HJC', description: 'High-pressure water cleaning of internals' },

  // ── Rotating ──────────────────────────────────────────────────────────────
  { category: 'Rotating', name: 'Pump Overhaul', code: 'ROT-PO', description: 'Complete pump disassembly, inspection, and reassembly' },
  { category: 'Rotating', name: 'Compressor Overhaul', code: 'ROT-CO', description: 'Complete compressor disassembly, inspection, and reassembly' },

  // ── Valve ─────────────────────────────────────────────────────────────────
  { category: 'Valve', name: 'Valve Overhaul', code: 'VLV-OH', description: 'Full valve disassembly, inspection, lapping, and reassembly' },
  { category: 'Valve', name: 'Lapping', code: 'VLV-LAP', description: 'Seat and disc lapping to restore sealing surfaces' },
  { category: 'Valve', name: 'Hydro Test', code: 'VLV-HT', description: 'Hydrostatic pressure testing of valve body and seat' },

  // ── Inspection ────────────────────────────────────────────────────────────
  { category: 'Inspection', name: 'Internal Inspection', code: 'INS-INT', description: 'Confined space entry inspection of vessel internals' },
  { category: 'Inspection', name: 'Eddy Current', code: 'INS-EC', description: 'Eddy current inspection of tubes and welds' },
  { category: 'Inspection', name: 'PMI', code: 'INS-PMI', description: 'Positive Material Identification testing' },
  { category: 'Inspection', name: 'Thickness Survey', code: 'INS-TS', description: 'Ultrasonic thickness measurement survey' },

  // ── Electrical ────────────────────────────────────────────────────────────
  { category: 'Electrical', name: 'Motor Overhaul', code: 'ELEC-MO', description: 'Electric motor disassembly, rewinding, and reassembly' },

  // ── Instrumentation ───────────────────────────────────────────────────────
  { category: 'Instrumentation', name: 'Calibration', code: 'INST-CAL', description: 'Instrument calibration and verification' },
];

export async function seedWorkTypes(prisma: PrismaClient, organizationId?: string) {
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < WORK_TYPES.length; i++) {
    const wt = WORK_TYPES[i];
    const existing = await (prisma as any).workType.findFirst({
      where: {
        organization_id: organizationId ?? null,
        code: wt.code,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await (prisma as any).workType.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId ?? null,
        category: wt.category,
        name: wt.name,
        code: wt.code,
        description: wt.description,
        sort_order: i,
        is_active: true,
      },
    });
    created++;
  }

  console.log(`[seed:work-types] Created ${created}, skipped ${skipped} (already exist)`);
  return { created, skipped };
}
