/**
 * Seed: Template Families — groups related templates by equipment type.
 * Per ADR-0012: Template Family enables the planner workflow:
 *   Equipment → Equipment Type → Template Family → Template Selection
 *
 * Usage: import { seedTemplateFamilies } from './seeds/template-families';
 *        await seedTemplateFamilies(prisma, organizationId);
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const TEMPLATE_FAMILIES: Array<{ name: string; code: string; equipment_type: string; description: string }> = [
  // ── Heat Exchangers ───────────────────────────────────────────────────────
  { name: 'Heat Exchanger Maintenance', code: 'HX-MAINT', equipment_type: 'Heat Exchanger', description: 'Templates for shell-and-tube, plate, and air-cooled heat exchanger maintenance' },

  // ── Pumps ─────────────────────────────────────────────────────────────────
  { name: 'Centrifugal Pump Maintenance', code: 'PUMP-CENT', equipment_type: 'Centrifugal Pump', description: 'Templates for centrifugal pump overhaul and maintenance' },
  { name: 'Reciprocating Pump Maintenance', code: 'PUMP-RECIP', equipment_type: 'Reciprocating Pump', description: 'Templates for reciprocating/positive displacement pump maintenance' },

  // ── Compressors ───────────────────────────────────────────────────────────
  { name: 'Centrifugal Compressor Maintenance', code: 'COMP-CENT', equipment_type: 'Centrifugal Compressor', description: 'Templates for centrifugal compressor overhaul' },
  { name: 'Reciprocating Compressor Maintenance', code: 'COMP-RECIP', equipment_type: 'Reciprocating Compressor', description: 'Templates for reciprocating compressor maintenance' },

  // ── Valves ────────────────────────────────────────────────────────────────
  { name: 'Safety Valve Maintenance', code: 'VLV-PSV', equipment_type: 'Pressure Safety Valve', description: 'Templates for PSV overhaul, testing, and certification' },
  { name: 'Control Valve Maintenance', code: 'VLV-CV', equipment_type: 'Control Valve', description: 'Templates for control valve overhaul and calibration' },
  { name: 'Gate/Globe Valve Maintenance', code: 'VLV-GG', equipment_type: 'Gate/Globe Valve', description: 'Templates for manual valve overhaul and lapping' },

  // ── Vessels & Columns ─────────────────────────────────────────────────────
  { name: 'Pressure Vessel Inspection', code: 'PV-INSP', equipment_type: 'Pressure Vessel', description: 'Templates for vessel internal inspection and maintenance' },
  { name: 'Column Maintenance', code: 'COL-MAINT', equipment_type: 'Column', description: 'Templates for distillation/fractionation column maintenance and tray work' },

  // ── Piping ────────────────────────────────────────────────────────────────
  { name: 'Piping Maintenance', code: 'PIPE-MAINT', equipment_type: 'Piping', description: 'Templates for pipe section replacement, weld repairs, and thickness surveys' },

  // ── Electrical ────────────────────────────────────────────────────────────
  { name: 'Electric Motor Maintenance', code: 'MOT-MAINT', equipment_type: 'Electric Motor', description: 'Templates for motor overhaul, rewinding, and alignment' },

  // ── Instrumentation ───────────────────────────────────────────────────────
  { name: 'Instrument Calibration', code: 'INST-MAINT', equipment_type: 'Instrument', description: 'Templates for instrument calibration and loop testing' },
];

export async function seedTemplateFamilies(prisma: PrismaClient, organizationId?: string) {
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < TEMPLATE_FAMILIES.length; i++) {
    const tf = TEMPLATE_FAMILIES[i];
    const existing = await prisma.templateFamily.findFirst({
      where: {
        organization_id: organizationId ?? null,
        code: tf.code,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.templateFamily.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId ?? null,
        name: tf.name,
        code: tf.code,
        description: tf.description,
        equipment_type: tf.equipment_type,
        sort_order: i,
        is_active: true,
      },
    });
    created++;
  }

  console.log(`[seed:template-families] Created ${created}, skipped ${skipped} (already exist)`);
  return { created, skipped };
}
