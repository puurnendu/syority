/**
 * M7.5 — Planner Workspace Service
 *
 * Aggregation queries for the workspace panels:
 * - Hierarchy tree with lazy children + rollup badges
 * - Workpack grid with joins
 * - Activity grid with joins + UDF
 * - Cross-entity search
 * - Batch update (planner-editable fields only)
 *
 * Consumes existing services — does NOT duplicate CRUD logic.
 */
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  type: 'site' | 'plant' | 'area' | 'unit' | 'system' | 'asset' | 'workpack';
  code: string;
  name: string;
  parentId: string | null;
  children?: TreeNode[];
  /** Rollup badges shown on the tree node */
  rollup?: {
    workpackCount: number;
    activityCount: number;
    totalDurationHrs: number;
  };
}

export interface WorkpackGridRow {
  id: string;
  workpack_number: string | null;
  title: string;
  equipment_tag: string | null;
  equipment_type: string | null;
  unit_code: string | null;
  unit_name: string | null;
  system_code: string | null;
  system_name: string | null;
  work_type: string | null;
  template_name: string | null;
  revision: string | null;
  discipline_name: string | null;
  discipline_code: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  planner_name: string | null;
  priority: string | null;
  status: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  duration_total: number;
  activity_count: number;
  resource_count: number;
  readiness_score: number;
  compliance_score: number;
  document_count: number;
  certificate_count: number;
  scope_item_id: string | null;
}

export interface ActivityGridRow {
  id: string;
  activity_id: string | null;
  description: string;
  wbs_code: string | null;
  discipline_code: string | null;
  discipline_name: string | null;
  duration_hours: number;
  planned_start: string | null;
  planned_end: string | null;
  early_start: string | null;
  early_finish: string | null;
  total_float: number | null;
  free_float: number | null;
  is_critical: boolean;
  manpower_count: number | null;
  manpower_type: string | null;
  priority: string | null;
  status: string | null;
  hold_point_type: string | null;
  notes: string | null;
  sequence_number: number | null;
  /** Predecessor strings like "A0010FS", "A0020SS+1d" */
  predecessors: string[];
  /** Successor strings */
  successors: string[];
  /** UDF values keyed by UDF code */
  udf_values: Record<string, string | number | boolean | null>;
  /** Whether activity came from template (controls locked column display) */
  is_template_generated: boolean;
  workpack_id: string | null;
}

export interface BatchUpdateItem {
  id: string;
  entity: 'activity' | 'workpack';
  field: string;
  value: string | number | boolean | null;
}

export interface BatchUpdateResult {
  updated: number;
  errors: { id: string; error: string }[];
}

// ── Allowed fields for batch update ───────────────────────────────────────────

const ACTIVITY_EDITABLE_FIELDS = new Set([
  'duration_hours',
  'planned_start',
  'planned_end',
  'manpower_count',
  'manpower_type',
  'priority',
  'notes',
  'wbs_code',
  'window',
]);

const WORKPACK_EDITABLE_FIELDS = new Set([
  'contractor_id',
  'priority',
  'planned_start_date',
  'planned_end_date',
]);

// ── Service ───────────────────────────────────────────────────────────────────

export class PlannerWorkspaceService {

  // ── Hierarchy Tree ────────────────────────────────────────────────────────

  /**
   * Build the hierarchy tree for an event.
   * Returns: Units → Systems → Assets → Workpacks (with rollup badges).
   */
  static async getHierarchyTree(
    organizationId: string,
    eventId: string,
  ): Promise<TreeNode[]> {
    // Get all workpacks for this event with hierarchy joins
    const workpacks = await prisma.workpack.findMany({
      where: {
        organization_id: organizationId,
        event_id: eventId,
        deleted_at: null,
      },
      select: {
        id: true,
        workpack_number: true,
        title: true,
        unit_id: true,
        system_id: true,
        asset_id: true,
        _count: { select: { activities: { where: { deleted_at: null } } } },
        activities: {
          where: { deleted_at: null },
          select: { duration_hours: true },
        },
        unit: { select: { id: true, code: true, name: true, plant_id: true } },
        system: { select: { id: true, code: true, name: true, unit_id: true } },
        asset: { select: { id: true, tag_number: true, name: true, system_id: true } },
      },
    });

    // Build hierarchy maps
    const unitMap = new Map<string, TreeNode>();
    const systemMap = new Map<string, TreeNode>();
    const assetMap = new Map<string, TreeNode>();

    for (const wp of workpacks) {
      const wpDuration = wp.activities.reduce(
        (sum, a) => sum + Number(a.duration_hours ?? 0), 0
      );
      const wpNode: TreeNode = {
        id: wp.id,
        type: 'workpack',
        code: wp.workpack_number ?? wp.id.slice(0, 8),
        name: wp.title,
        parentId: wp.asset_id ?? wp.system_id ?? wp.unit_id ?? null,
        rollup: {
          workpackCount: 1,
          activityCount: wp._count.activities,
          totalDurationHrs: wpDuration,
        },
      };

      // Ensure parent nodes exist
      if (wp.asset && wp.asset_id) {
        if (!assetMap.has(wp.asset_id)) {
          assetMap.set(wp.asset_id, {
            id: wp.asset_id,
            type: 'asset',
            code: wp.asset.tag_number,
            name: wp.asset.name,
            parentId: wp.asset.system_id,
            children: [],
            rollup: { workpackCount: 0, activityCount: 0, totalDurationHrs: 0 },
          });
        }
        const assetNode = assetMap.get(wp.asset_id)!;
        assetNode.children!.push(wpNode);
        assetNode.rollup!.workpackCount += 1;
        assetNode.rollup!.activityCount += wp._count.activities;
        assetNode.rollup!.totalDurationHrs += wpDuration;
      }

      if (wp.system && wp.system_id) {
        if (!systemMap.has(wp.system_id)) {
          systemMap.set(wp.system_id, {
            id: wp.system_id,
            type: 'system',
            code: wp.system.code ?? '',
            name: wp.system.name,
            parentId: wp.system.unit_id,
            children: [],
            rollup: { workpackCount: 0, activityCount: 0, totalDurationHrs: 0 },
          });
        }
      }

      if (wp.unit && wp.unit_id) {
        if (!unitMap.has(wp.unit_id)) {
          unitMap.set(wp.unit_id, {
            id: wp.unit_id,
            type: 'unit',
            code: wp.unit.code ?? '',
            name: wp.unit.name,
            parentId: wp.unit.plant_id,
            children: [],
            rollup: { workpackCount: 0, activityCount: 0, totalDurationHrs: 0 },
          });
        }
      }
    }

    // Wire assets into systems
    for (const [, assetNode] of assetMap) {
      if (assetNode.parentId && systemMap.has(assetNode.parentId)) {
        const sysNode = systemMap.get(assetNode.parentId)!;
        sysNode.children!.push(assetNode);
        sysNode.rollup!.workpackCount += assetNode.rollup!.workpackCount;
        sysNode.rollup!.activityCount += assetNode.rollup!.activityCount;
        sysNode.rollup!.totalDurationHrs += assetNode.rollup!.totalDurationHrs;
      }
    }

    // Wire systems into units
    for (const [, sysNode] of systemMap) {
      if (sysNode.parentId && unitMap.has(sysNode.parentId)) {
        const unitNode = unitMap.get(sysNode.parentId)!;
        unitNode.children!.push(sysNode);
        unitNode.rollup!.workpackCount += sysNode.rollup!.workpackCount;
        unitNode.rollup!.activityCount += sysNode.rollup!.activityCount;
        unitNode.rollup!.totalDurationHrs += sysNode.rollup!.totalDurationHrs;
      }
    }

    return Array.from(unitMap.values());
  }

  // ── Workpack Grid ─────────────────────────────────────────────────────────

  /**
   * Get workpack grid data for an event, with optional unit/system/asset filter.
   */
  static async getWorkpackGrid(params: {
    organizationId: string;
    eventId: string;
    unitId?: string;
    systemId?: string;
    assetId?: string;
  }): Promise<WorkpackGridRow[]> {
    const where: Prisma.WorkpackWhereInput = {
      organization_id: params.organizationId,
      event_id: params.eventId,
      deleted_at: null,
      ...(params.unitId && { unit_id: params.unitId }),
      ...(params.systemId && { system_id: params.systemId }),
      ...(params.assetId && { asset_id: params.assetId }),
    };

    const workpacks = await prisma.workpack.findMany({
      where,
      include: {
        asset: { select: { tag_number: true, asset_type: true } },
        unit: { select: { code: true, name: true } },
        system: { select: { code: true, name: true } },
        discipline: { select: { name: true, code: true } },
        contractor: { select: { name: true } },
        User_Workpack_created_byToUser: { select: { name: true } },
        activities: {
          where: { deleted_at: null },
          select: {
            duration_hours: true,
            resources: { select: { id: true } },
          },
        },
        workpack_documents: { select: { id: true } },
        certificateInstances: { select: { id: true } },
      },
      orderBy: { workpack_number: 'asc' },
    });

    return workpacks.map((wp) => {
      const totalDuration = wp.activities.reduce(
        (sum, a) => sum + Number(a.duration_hours ?? 0), 0
      );
      const totalResources = wp.activities.reduce(
        (sum, a) => sum + a.resources.length, 0
      );

      return {
        id: wp.id,
        workpack_number: wp.workpack_number,
        title: wp.title,
        equipment_tag: wp.asset?.tag_number ?? null,
        equipment_type: wp.equipment_type,
        unit_code: wp.unit?.code ?? null,
        unit_name: wp.unit?.name ?? null,
        system_code: wp.system?.code ?? null,
        system_name: wp.system?.name ?? null,
        work_type: wp.work_type,
        template_name: null, // Joined separately if needed (workpack_templates is a different model)
        revision: wp.revision,
        discipline_name: wp.discipline?.name ?? null,
        discipline_code: wp.discipline?.code ?? null,
        contractor_id: wp.contractor_id,
        contractor_name: wp.contractor?.name ?? null,
        planner_name: wp.User_Workpack_created_byToUser?.name ?? null,
        priority: wp.priority,
        status: wp.status,
        planned_start_date: wp.planned_start_date?.toISOString() ?? null,
        planned_end_date: wp.planned_end_date?.toISOString() ?? null,
        duration_total: totalDuration,
        activity_count: wp.activities.length,
        resource_count: totalResources,
        readiness_score: wp.readiness_score ?? 0,
        compliance_score: wp.compliance_score ?? 0,
        document_count: wp.workpack_documents.length,
        certificate_count: wp.certificateInstances.length,
        scope_item_id: wp.scope_item_id,
      };
    });
  }

  // ── Activity Grid ─────────────────────────────────────────────────────────

  /**
   * Get activity grid data for one or more workpacks.
   * Includes predecessors/successors as display strings and UDF values.
   */
  static async getActivityGrid(params: {
    organizationId: string;
    workpackIds?: string[];
    eventId?: string;
  }): Promise<ActivityGridRow[]> {
    const where: Prisma.ActivityWhereInput = {
      organization_id: params.organizationId,
      deleted_at: null,
      ...(params.workpackIds && params.workpackIds.length > 0
        ? { workpack_id: { in: params.workpackIds } }
        : {}),
      ...(params.eventId ? { event_id: params.eventId } : {}),
    };

    const activities = await prisma.activity.findMany({
      where,
      include: {
        discipline: { select: { code: true, name: true } },
        predecessors: {
          include: {
            predecessor: { select: { activity_id: true } },
          },
        },
        successors: {
          include: {
            successor: { select: { activity_id: true } },
          },
        },
        udf_values: {
          include: {
            udf_definition: { select: { code: true, type: true } },
          },
        },
      },
      orderBy: [{ workpack_id: 'asc' }, { sequence_number: 'asc' }],
    });

    return activities.map((act) => {
      // Format predecessor strings: "A0010FS", "A0020SS+1d"
      const predecessors = act.predecessors.map((rel) => {
        const predId = rel.predecessor.activity_id ?? rel.predecessor_id.slice(0, 8);
        const type = rel.relationship_type ?? 'FS';
        const lag = rel.lag_days && rel.lag_days > 0 ? `+${rel.lag_days}d` : '';
        return `${predId}${type}${lag}`;
      });

      const successors = act.successors.map((rel) => {
        const succId = rel.successor.activity_id ?? rel.successor_id.slice(0, 8);
        const type = rel.relationship_type ?? 'FS';
        const lag = rel.lag_days && rel.lag_days > 0 ? `+${rel.lag_days}d` : '';
        return `${succId}${type}${lag}`;
      });

      // Build UDF map
      const udf_values: Record<string, string | number | boolean | null> = {};
      for (const uv of act.udf_values) {
        const code = uv.udf_definition.code;
        if (uv.udf_definition.type === 'number' && uv.value_number != null) {
          udf_values[code] = Number(uv.value_number);
        } else if (uv.udf_definition.type === 'boolean' && uv.value_boolean != null) {
          udf_values[code] = uv.value_boolean;
        } else if (uv.value_string != null) {
          udf_values[code] = uv.value_string;
        } else {
          udf_values[code] = null;
        }
      }

      return {
        id: act.id,
        activity_id: act.activity_id,
        description: act.description,
        wbs_code: act.wbs_code,
        discipline_code: act.discipline?.code ?? null,
        discipline_name: act.discipline?.name ?? null,
        duration_hours: Number(act.duration_hours ?? 0),
        planned_start: act.planned_start?.toISOString() ?? null,
        planned_end: act.planned_end?.toISOString() ?? null,
        early_start: act.early_start?.toISOString() ?? null,
        early_finish: act.early_finish?.toISOString() ?? null,
        total_float: act.total_float ? Number(act.total_float) : null,
        free_float: act.free_float ?? null,
        is_critical: act.is_critical ?? false,
        manpower_count: act.manpower_count,
        manpower_type: act.manpower_type,
        priority: null, // Inherits from workpack if null (client logic)
        status: act.status,
        hold_point_type: act.hold_point_type,
        notes: act.notes,
        sequence_number: act.sequence_number,
        predecessors,
        successors,
        udf_values,
        is_template_generated: !!act.activity_library_id,
        workpack_id: act.workpack_id,
      };
    });
  }

  // ── Batch Update ──────────────────────────────────────────────────────────

  /**
   * Batch update multiple entities in a single transaction.
   * Enforces planner-editable field restrictions.
   */
  static async batchUpdate(
    organizationId: string,
    userId: string,
    updates: BatchUpdateItem[],
  ): Promise<BatchUpdateResult> {
    const errors: { id: string; error: string }[] = [];
    const validUpdates: BatchUpdateItem[] = [];

    // Validate fields
    for (const u of updates) {
      const allowed = u.entity === 'activity' ? ACTIVITY_EDITABLE_FIELDS : WORKPACK_EDITABLE_FIELDS;
      if (!allowed.has(u.field)) {
        errors.push({ id: u.id, error: `Field "${u.field}" is not editable for ${u.entity}` });
      } else {
        validUpdates.push(u);
      }
    }

    if (validUpdates.length === 0) {
      return { updated: 0, errors };
    }

    // Execute in transaction
    await prisma.$transaction(
      validUpdates.map((u) => {
        if (u.entity === 'activity') {
          return prisma.activity.update({
            where: { id: u.id, organization_id: organizationId },
            data: { [u.field]: u.value, updated_by: userId },
          });
        } else {
          return prisma.workpack.update({
            where: { id: u.id, organization_id: organizationId },
            data: { [u.field]: u.value, updated_by: userId },
          });
        }
      }),
    );

    // Audit log (batch)
    await AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'batch_updated',
      model_name: 'PlannerWorkspace',
      model_id: 'batch',
      new_values: {
        count: validUpdates.length,
        fields: [...new Set(validUpdates.map((u) => u.field))],
      },
    });

    return { updated: validUpdates.length, errors };
  }

  // ── Cross-Entity Search ───────────────────────────────────────────────────

  /**
   * Search across workpacks, activities, and assets within an event.
   */
  static async search(
    organizationId: string,
    eventId: string,
    query: string,
    limit = 20,
  ) {
    const q = `%${query}%`;

    const [workpacks, activities] = await Promise.all([
      prisma.workpack.findMany({
        where: {
          organization_id: organizationId,
          event_id: eventId,
          deleted_at: null,
          OR: [
            { workpack_number: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, workpack_number: true, title: true },
        take: limit,
      }),
      prisma.activity.findMany({
        where: {
          organization_id: organizationId,
          event_id: eventId,
          deleted_at: null,
          OR: [
            { activity_id: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, activity_id: true, description: true, workpack_id: true },
        take: limit,
      }),
    ]);

    return {
      workpacks: workpacks.map((w) => ({
        id: w.id,
        type: 'workpack' as const,
        label: `${w.workpack_number} — ${w.title}`,
      })),
      activities: activities.map((a) => ({
        id: a.id,
        type: 'activity' as const,
        label: `${a.activity_id} — ${a.description}`,
        workpackId: a.workpack_id,
      })),
    };
  }
}
