/**
 * M16 — Entity Resolver
 *
 * Event-scoped domain entity resolution for M16 interactions.
 *
 * Resolves equipment tags, workpack codes, and activity descriptions
 * to their authoritative database records, ALWAYS scoped to the
 * interaction's organization AND event context.
 *
 * ARCHITECTURE:
 *   - Every domain query includes organization_id + event_id filter
 *   - Never resolves using organization_id alone for event-scoped entities
 *   - Returns AMBIGUOUS with candidates instead of silently picking first match
 *   - Does NOT import or use the legacy WhatsApp database matching module
 *
 * AUTHORITY:
 *   - M16EntityResolver reads domain entities — it does NOT mutate them
 *   - It does NOT calculate progress, CPM, readiness, or any business metric
 */

import { prisma } from '@/lib/prisma';
import type {
  M16InteractionContext,
  EquipmentResolution,
  WorkpackResolution,
  ActivityResolution,
  M16ResolvedEntities,
} from '../types';

// ── Equipment Resolution ──────────────────────────────────────────────────────

/**
 * Resolve an equipment tag to an asset record.
 *
 * @param ctx       - M16InteractionContext (provides organizationId)
 * @param tagNumber - Equipment tag (e.g., "HX-204", "E-101A")
 */
export async function resolveEquipment(
  ctx: M16InteractionContext,
  tagNumber: string
): Promise<EquipmentResolution> {
  if (!tagNumber || tagNumber.trim().length === 0) {
    return { outcome: 'NOT_FOUND' };
  }

  const assets = await prisma.asset.findMany({
    where: {
      organization_id: ctx.organizationId,
      tag_number: { equals: tagNumber.trim(), mode: 'insensitive' },
      deleted_at: null,
    },
    select: {
      id: true,
      tag_number: true,
      name: true,
      unit_id: true,
    },
    take: 10,
  });

  if (assets.length === 0) {
    return { outcome: 'NOT_FOUND' };
  }

  if (assets.length === 1) {
    return {
      outcome: 'RESOLVED',
      assetId: assets[0].id,
      tagNumber: assets[0].tag_number || tagNumber,
      assetName: assets[0].name || undefined,
      unitId: assets[0].unit_id || undefined,
    };
  }

  // Multiple assets with same tag — rare but possible
  return {
    outcome: 'AMBIGUOUS',
    candidates: assets.map((a) => ({
      id: a.id,
      tagNumber: a.tag_number || tagNumber,
      name: a.name || 'Unknown',
    })),
  };
}

// ── Workpack Resolution ───────────────────────────────────────────────────────

/**
 * Resolve workpacks for an asset, scoped to the interaction's event.
 *
 * MANDATORY: Uses both organization_id AND event_id for scoping.
 * Never resolves workpacks using organization_id alone.
 *
 * @param ctx     - M16InteractionContext (provides organizationId + eventId)
 * @param assetId - Resolved asset ID from resolveEquipment()
 */
export async function resolveWorkpacks(
  ctx: M16InteractionContext,
  assetId: string
): Promise<WorkpackResolution> {
  if (!ctx.eventId) {
    return { outcome: 'NOT_FOUND' };
  }

  const workpacks = await prisma.workpack.findMany({
    where: {
      organization_id: ctx.organizationId,
      event_id: ctx.eventId,
      asset_id: assetId,
      deleted_at: null,
      status: { notIn: ['completed', 'cancelled'] },
    },
    select: {
      id: true,
      workpack_number: true,
      title: true,
      event_id: true,
      event: { select: { code: true } },
    },
    take: 10,
  });

  if (workpacks.length === 0) {
    return { outcome: 'NOT_FOUND' };
  }

  if (workpacks.length === 1) {
    return {
      outcome: 'RESOLVED',
      workpackId: workpacks[0].id,
      workpackNumber: workpacks[0].workpack_number || undefined,
      workpackTitle: workpacks[0].title,
      eventId: workpacks[0].event_id || undefined,
    };
  }

  // Multiple workpacks for same asset in same event — ask user
  return {
    outcome: 'AMBIGUOUS',
    candidates: workpacks.map((wp) => ({
      id: wp.id,
      number: wp.workpack_number || 'Unknown',
      title: wp.title,
      eventCode: wp.event?.code,
    })),
  };
}

// ── Activity Resolution ───────────────────────────────────────────────────────

/**
 * Resolve activities within a workpack, scoped to the interaction's event.
 *
 * If a description hint is provided, performs case-insensitive matching
 * to narrow candidates. Otherwise returns all non-cancelled activities.
 *
 * @param ctx           - M16InteractionContext
 * @param workpackId    - Resolved workpack ID
 * @param descriptionHint - Optional description from LLM extraction (untrusted text, not ID)
 */
export async function resolveActivity(
  ctx: M16InteractionContext,
  workpackId: string,
  descriptionHint?: string
): Promise<ActivityResolution> {
  const activities = await prisma.activity.findMany({
    where: {
      organization_id: ctx.organizationId,
      workpack_id: workpackId,
      event_id: ctx.eventId,
      deleted_at: null,
      status: { not: 'cancelled' },
    },
    select: {
      id: true,
      activity_number: true,
      description: true,
      workpack_id: true,
    },
    take: 20,
  });

  if (activities.length === 0) {
    return { outcome: 'NOT_FOUND' };
  }

  // If exactly one activity, resolve directly
  if (activities.length === 1) {
    return {
      outcome: 'RESOLVED',
      activityId: activities[0].id,
      activityNumber: activities[0].activity_number || undefined,
      description: activities[0].description,
      workpackId: activities[0].workpack_id || undefined,
    };
  }

  // If description hint provided, try to narrow down
  if (descriptionHint) {
    const hint = descriptionHint.toLowerCase().trim();
    const matches = activities.filter((a) =>
      a.description.toLowerCase().includes(hint)
    );

    if (matches.length === 1) {
      return {
        outcome: 'RESOLVED',
        activityId: matches[0].id,
        activityNumber: matches[0].activity_number || undefined,
        description: matches[0].description,
        workpackId: matches[0].workpack_id || undefined,
      };
    }

    // Still ambiguous — return filtered candidates if any, else all
    const candidates = matches.length > 0 ? matches : activities;
    return {
      outcome: 'AMBIGUOUS',
      candidates: candidates.map((a) => ({
        id: a.id,
        number: a.activity_number || 'Unknown',
        description: a.description,
      })),
    };
  }

  // Multiple activities, no hint — ambiguous
  return {
    outcome: 'AMBIGUOUS',
    candidates: activities.map((a) => ({
      id: a.id,
      number: a.activity_number || 'Unknown',
      description: a.description,
    })),
  };
}

// ── Composite Resolution ──────────────────────────────────────────────────────

/**
 * Perform full entity resolution chain: Equipment → Workpack → Activity
 *
 * Stops at the first unresolvable or ambiguous step.
 *
 * @param ctx             - M16InteractionContext
 * @param equipmentTag    - Equipment tag hint from LLM (untrusted text)
 * @param descriptionHint - Activity description hint from LLM (untrusted text)
 */
export async function resolveEntityChain(
  ctx: M16InteractionContext,
  equipmentTag?: string,
  descriptionHint?: string
): Promise<M16ResolvedEntities> {
  const result: M16ResolvedEntities = {
    equipment: null,
    workpack: null,
    activity: null,
  };

  // Step 1: Equipment
  if (!equipmentTag) return result;

  const equipmentResult = await resolveEquipment(ctx, equipmentTag);
  result.equipment = equipmentResult;
  if (equipmentResult.outcome !== 'RESOLVED' || !equipmentResult.assetId) {
    return result;
  }

  // Step 2: Workpack (requires event context)
  if (!ctx.eventId) return result;

  const workpackResult = await resolveWorkpacks(ctx, equipmentResult.assetId);
  result.workpack = workpackResult;
  if (workpackResult.outcome !== 'RESOLVED' || !workpackResult.workpackId) {
    return result;
  }

  // Step 3: Activity
  const activityResult = await resolveActivity(ctx, workpackResult.workpackId, descriptionHint);
  result.activity = activityResult;

  return result;
}
