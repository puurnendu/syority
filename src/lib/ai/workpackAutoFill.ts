/**
 * Orchestrates AI auto-fill for new workpacks: joints, materials, tools, constraints.
 * Called after workpack creation (fire-and-forget). Runs in background; failures are logged only.
 */

import { prisma } from '@/lib/prisma';
import { getStandardJointsForType } from '@/lib/ai/jointExtraction';
import { loadProviderForJob, callTextAi } from '@/services/ai/ProviderLoader';
import { generateSyorityAI, SyorityAiConfig } from './universalAiClient';
const crypto = globalThis.crypto;

type AutoFillOptions = {
  joints?: boolean;
  materials?: boolean;
  tools?: boolean;
  constraints?: boolean;
};

async function generateJointsAutoFill(workpackId: string, orgId: string, workpack: { equipment_type?: string | null; title?: string; unit_code?: string | null }) {
  const existing = await prisma.jointIntegrityItem.count({
    where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null },
  });
  if (existing > 0) return;

  const equipmentType = (workpack.equipment_type ?? 'heat_exchanger').toString().toLowerCase().replace(/\s+/g, '_');
  const tag = (workpack.unit_code ?? workpack.title ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 8) || 'WP';
  const joints = getStandardJointsForType(equipmentType, tag);

  const wp = await prisma.workpack.findFirst({
    where: { id: workpackId, organization_id: orgId },
    select: { id: true, organization_id: true, site_id: true },
  });
  if (!wp?.site_id) return;

  const existingSet = new Set(
    (await prisma.jointIntegrityItem.findMany({
      where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null },
      select: { joint_number: true },
    })).map((j) => j.joint_number)
  );

  for (const j of joints) {
    const jointNo = (j.jointNo ?? '').trim();
    if (!jointNo || existingSet.has(jointNo)) continue;
    await prisma.jointIntegrityItem.create({
      data: {
        workpack_id: workpackId,
        organization_id: wp.organization_id,
        site_id: wp.site_id,
        joint_number: jointNo,
        line_number: j.lineNumber ?? null,
        specification: j.pipeSpec ?? null,
        rating: j.flangeRating ?? null,
        flange_size: j.size ?? null,
        location: j.location ?? null,
        flange_type: j.gasketType ?? null,
        gasket_material: j.gasketMaterial ?? null,
        bolt_reference_standard: j.boltSpec ?? null,
        status: 'pending',
        ai_generated: true,
      },
    });
    existingSet.add(jointNo);
  }
}

async function generateMaterialsAutoFill(
  workpackId: string,
  orgId: string,
  workpack: {
    equipment_type?: string | null;
    title?: string;
    scope_of_work?: string | null;
    joint_integrity_items?: unknown[];
    blinds?: unknown[];
    activities?: unknown[];
    asset?: { tag?: string; name?: string } | null;
  },
  settings: { model: string; apiKey: string; maxTokens: number; temperature: number }
) {
  const existing = await prisma.workpack_material_lines.count({
    where: { workpack_id: workpackId, deleted_at: null },
  });
  if (existing > 0) return;

  const equipmentTag = (workpack.asset?.tag ?? workpack.asset?.name ?? workpack.title ?? '').toString().trim();
  const equipmentType = (workpack.equipment_type ?? 'Equipment').toString();
  const scopeHint = (workpack.scope_of_work ?? '').toString().trim();
  const jointsJson = JSON.stringify(workpack.joint_integrity_items ?? [], null, 2);
  const blindsJson = JSON.stringify(workpack.blinds ?? [], null, 2);
  const activitiesJson = JSON.stringify(workpack.activities ?? [], null, 2);

  const prompt = `You are an expert mechanical engineer. Generate a complete material list for this maintenance workpack.
Equipment: ${equipmentTag || '(not specified)'} — ${equipmentType}
Scope: ${scopeHint || '(no scope)'}
Joint data: ${jointsJson}
Blind data: ${blindsJson}
Activities: ${activitiesJson}
Generate gaskets (1 per joint), bolts/nuts per joint, blind gaskets, welding/cleaning consumables, misc. Return ONLY a valid JSON array of objects with: category, description, quantity, unit (EA), spec, linkedJointNo, source (joint|blind|activity|misc), notes.`;

  let items: unknown[];
  try {
    const config: SyorityAiConfig = {
      modelIdentifier: settings.model,
      apiKey: settings.apiKey,
      organizationId: orgId,
      maxTokens: Math.min(settings.maxTokens, 8192),
      temperature: settings.temperature,
    };
    items = await generateSyorityAI(config, prompt);
  } catch {
    return;
  }

  const materials = items
    .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
    .map((m) => ({
      category: typeof m.category === 'string' ? m.category : 'Misc',
      itemCode: m.itemCode != null ? String(m.itemCode) : null,
      description: typeof m.description === 'string' ? m.description : String(m.description ?? ''),
      quantity: typeof m.quantity === 'number' ? m.quantity : Number(m.quantity) || 1,
      unit: typeof m.unit === 'string' ? m.unit : 'EA',
      spec: m.spec != null ? String(m.spec) : null,
      linkedJointNo: m.linkedJointNo != null ? String(m.linkedJointNo) : null,
      source: typeof m.source === 'string' ? m.source : 'misc',
      notes: m.notes != null ? String(m.notes) : null,
    }));

  for (const m of materials) {
    if (!m.description?.trim()) continue;
    await prisma.workpack_material_lines.create({
      data: {
        organization_id: orgId,
        workpack_id: workpackId,
        source_type: 'ai',
        source_id: null,
        category: m.category || null,
        linked_to: m.linkedJointNo?.trim() || null,
        item_code: m.itemCode?.trim() || null,
        description: m.description,
        specification: m.spec?.trim() || null,
        unit_of_measure: (m.unit || 'EA').toString().trim() || 'EA',
        quantity_required: typeof m.quantity === 'number' ? m.quantity : 1,
        procurement_status: 'not_requested',
        ai_generated: true,
        notes: m.notes?.trim() || null,
      },
    });
  }
}

async function generateToolsAutoFill(
  workpackId: string,
  orgId: string,
  workpack: {
    equipment_type?: string | null;
    title?: string;
    activities?: unknown[];
    asset?: { tag?: string; name?: string } | null;
  },
  settings: { model: string; apiKey: string; maxTokens: number; temperature: number }
) {
  const existing = await prisma.workpack_tools.count({
    where: { workpack_id: workpackId },
  });
  if (existing > 0) return;

  const equipmentTag = (workpack.asset?.tag ?? workpack.asset?.name ?? workpack.title ?? '').toString().trim();
  const equipmentType = (workpack.equipment_type ?? 'Equipment').toString();
  const activitiesJson = JSON.stringify(workpack.activities ?? [], null, 2);

  const prompt = `You are an expert maintenance planner. Generate a tool list for this workpack.
Equipment: ${equipmentTag || '(not specified)'} — ${equipmentType}
Activities: ${activitiesJson}
Include: Rigging (crane, slings, chain blocks), Mechanical (torque wrench, flange spreader, bundle extractor, tube expansion), Measurement (vernier, UT gauge), Safety (gas detector, harness), Cleaning (water jetter). Return ONLY a valid JSON array of objects with: category (Rigging|Lifting|Mechanical|Measurement|Safety|Cleaning|General), name, description, quantity, unit (EA), toolType (Standard|Special|Hired|Consumable), certRequired (boolean), notes.`;

  let items: unknown[];
  try {
    const config: SyorityAiConfig = {
      modelIdentifier: settings.model,
      apiKey: settings.apiKey,
      organizationId: orgId,
      maxTokens: Math.min(settings.maxTokens, 8192),
      temperature: settings.temperature,
    };
    items = await generateSyorityAI(config, prompt);
  } catch {
    return;
  }

  const validCategories = ['Rigging', 'Lifting', 'Mechanical', 'Electrical', 'Hydraulic', 'Measurement', 'Safety', 'Cleaning', 'Welding', 'Scaffolding', 'General'];
  const validToolTypes = ['Standard', 'Special', 'Hired', 'Consumable'];

  for (const t of items) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : String(o.name ?? '').trim();
    if (!name) continue;
    const category = validCategories.includes(String(o.category)) ? (o.category as string) : 'General';
    const toolType = validToolTypes.includes(String(o.toolType)) ? (o.toolType as string) : 'Standard';
    await prisma.workpack_tools.create({
      data: {
        id: crypto.randomUUID(),
        workpack_id: workpackId,
        organization_id: orgId,
        category: category as 'Rigging' | 'Lifting' | 'Mechanical' | 'Electrical' | 'Hydraulic' | 'Measurement' | 'Safety' | 'Cleaning' | 'Welding' | 'Scaffolding' | 'General',
        name,
        description: (o.description != null ? String(o.description) : null) || null,
        quantity: typeof o.quantity === 'number' ? o.quantity : parseInt(String(o.quantity), 10) || 1,
        unit: typeof o.unit === 'string' ? o.unit : 'EA',
        tool_type: toolType,
        cert_required: Boolean(o.certRequired),
        notes: (o.notes != null ? String(o.notes) : null) || null,
        source: 'ai',
        ai_generated: true,
        updated_at: new Date(),
      },
    });
  }
}

async function generateConstraintsAutoFill(
  workpackId: string,
  orgId: string,
  workpack: {
    equipment_type?: string | null;
    title?: string;
    scope_of_work?: string | null;
    workpack_id_code?: string | null;
  },
  settings: { model: string; apiKey: string; maxTokens: number; temperature: number }
) {
  const existing = await prisma.constraintLog.count({
    where: { workpack_id: workpackId, deleted_at: null },
  });
  if (existing > 0) return;

  const equipmentTag = (workpack.title ?? '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) || 'WP';
  const equipmentType = (workpack.equipment_type ?? 'Equipment').toString();
  const scopeDescription = (workpack.scope_of_work ?? '').toString().slice(0, 500);

  const prompt = `You are a turnaround planning engineer. Generate typical pre-job constraints (open items to resolve before/during the job) for this workpack.
Equipment: ${equipmentTag} — ${equipmentType}
Scope: ${scopeDescription || '(no scope)'}

Generate constraints in categories: Permits & Isolation, Materials & Procurement, Documentation, Inspection & Hold Points, Utilities & Services, Safety.
Return ONLY a valid JSON array. Each object: { "category": "technical" or short label, "title": "string", "description": "string", "severity": "medium" | "high" | "critical" }.
Use 8-18 items. status is always "open".`;

  let items: unknown[];
  try {
    const config: SyorityAiConfig = {
      modelIdentifier: settings.model,
      apiKey: settings.apiKey,
      organizationId: orgId,
      maxTokens: Math.min(settings.maxTokens, 4096),
      temperature: settings.temperature,
    };
    items = await generateSyorityAI(config, prompt);
  } catch {
    return;
  }

  const wpRef = workpack.workpack_id_code ?? workpackId.slice(0, 8);
  let seq = existing;
  const severityMap: Record<string, string> = { critical: 'critical', high: 'high', medium: 'medium', low: 'medium' };

  for (const c of items) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title : String(o.title ?? '').trim();
    if (!title) continue;
    seq++;
    const conNum = `CON-${wpRef}-${String(seq).padStart(3, '0')}`;
    const severity = severityMap[String(o.severity).toLowerCase()] ?? 'medium';
    await prisma.constraintLog.create({
      data: {
        organization_id: orgId,
        workpack_id: workpackId,
        constraint_number: conNum,
        title,
        description: (typeof o.description === 'string' ? o.description : String(o.description ?? '')).slice(0, 5000),
        category: 'technical',
        severity,
        status: 'open',
        ai_generated: true,
        is_in_central_register: true,
      },
    });
  }
}

export async function triggerAiAutoFill(workpackId: string, options: AutoFillOptions): Promise<void> {
  try {
    const workpack = await prisma.workpack.findFirst({
      where: { id: workpackId },
      include: {
        asset: { select: { tag_number: true, name: true } },
        joint_integrity_items: { where: { deleted_at: null }, select: { joint_number: true, flange_size: true, rating: true, specification: true, pipeline_number: true, gasket_material: true, bolt_material: true, bolt_quantity: true } },
        blinds: { select: { blind_number: true, blind_type: true, location: true, flange_size: true, rating: true } },
        activities: { orderBy: { sequence_number: 'asc' }, select: { id: true, description: true, work_category: true, sequence_number: true } },
      },
    });
    if (!workpack) return;
    const orgId = workpack.organization_id;

    const aiConfig = await loadProviderForJob(orgId, 'workpack_generation');

    const settings = {
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      maxTokens: 4096,
      temperature: 0.1,
    };

    if (options.joints) await generateJointsAutoFill(workpackId, orgId, workpack);
    if (options.materials) await generateMaterialsAutoFill(workpackId, orgId, workpack, settings);
    if (options.tools) await generateToolsAutoFill(workpackId, orgId, workpack, settings);
    if (options.constraints) await generateConstraintsAutoFill(workpackId, orgId, workpack, settings);

    await prisma.workpack.update({
      where: { id: workpackId },
      data: { ai_auto_filled: true, ai_auto_filled_at: new Date() },
    });
  } catch (err) {
    console.error('[AutoFill] Error:', err);
  }
}
