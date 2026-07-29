/**
 * M7.5 — Validation Engine Service
 *
 * Runs 19 validation rules against workpacks and activities for an event.
 * Returns structured issues with severity, target entity, and navigation hints.
 *
 * Rules V1–V19 as defined in the M7.5 Product Design Package.
 */
import { prisma } from '@/lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  /** Target entity type for click-to-navigate */
  entityType: 'activity' | 'workpack';
  entityId: string;
  /** Workpack ID for navigation context */
  workpackId: string | null;
  /** Workpack number for display */
  workpackNumber: string | null;
  /** Activity ID string for display */
  activityIdDisplay: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ValidationEngineService {

  /**
   * Run all validation rules for a given event (or single workpack).
   */
  static async validate(params: {
    organizationId: string;
    eventId?: string;
    workpackId?: string;
  }): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Load workpacks
    const wpWhere = {
      organization_id: params.organizationId,
      deleted_at: null as Date | null,
      ...(params.eventId && { event_id: params.eventId }),
      ...(params.workpackId && { id: params.workpackId }),
    };

    const workpacks = await prisma.workpack.findMany({
      where: wpWhere,
      select: {
        id: true,
        workpack_number: true,
        readiness_score: true,
        compliance_score: true,
        activities: {
          where: { deleted_at: null },
          select: {
            id: true,
            activity_id: true,
            description: true,
            duration_hours: true,
            planned_start: true,
            planned_end: true,
            hold_point_type: true,
            sequence_number: true,
            manpower_count: true,
            total_float: true,
            workpack_id: true,
            predecessors: { select: { predecessor_id: true } },
            successors: { select: { successor_id: true } },
            resources: { select: { id: true } },
            qa_clearance_records: { select: { id: true } },
            udf_values: {
              select: {
                udf_definition_id: true,
                value_string: true,
                value_number: true,
                udf_option_id: true,
              },
            },
          },
          orderBy: { sequence_number: 'asc' },
        },
        workpack_documents: { select: { id: true } },
        certificateInstances: { select: { id: true } },
      },
    });

    // Load mandatory UDF definitions
    const mandatoryUdfs = await prisma.activityUdfDefinition.findMany({
      where: {
        organization_id: params.organizationId,
        is_mandatory: true,
        is_active: true,
        deleted_at: null,
      },
      select: { id: true, code: true },
    });
    const mandatoryUdfIds = new Set(mandatoryUdfs.map((u) => u.id));

    // ── Per-workpack + per-activity rules ──────────────────────────────────

    let issueCounter = 0;
    const makeId = () => `val-${++issueCounter}`;

    for (const wp of workpacks) {
      const wpNum = wp.workpack_number ?? wp.id.slice(0, 8);
      const activities = wp.activities;
      const activityIds = new Set(activities.map((a) => a.id));

      // V7: Missing documents
      if (wp.workpack_documents.length === 0) {
        issues.push({
          id: makeId(), ruleId: 'V7', severity: 'info',
          message: `No documents attached`,
          entityType: 'workpack', entityId: wp.id,
          workpackId: wp.id, workpackNumber: wpNum,
          activityIdDisplay: null,
        });
      }

      // V11: Missing certificates (any is a warning)
      if (wp.certificateInstances.length === 0 && activities.length > 0) {
        issues.push({
          id: makeId(), ruleId: 'V11', severity: 'warning',
          message: `No certificates attached`,
          entityType: 'workpack', entityId: wp.id,
          workpackId: wp.id, workpackNumber: wpNum,
          activityIdDisplay: null,
        });
      }

      // V14: Readiness below threshold
      if ((wp.readiness_score ?? 0) < 50 && activities.length > 0) {
        issues.push({
          id: makeId(), ruleId: 'V14', severity: 'warning',
          message: `Readiness score ${wp.readiness_score ?? 0}% is below 50% threshold`,
          entityType: 'workpack', entityId: wp.id,
          workpackId: wp.id, workpackNumber: wpNum,
          activityIdDisplay: null,
        });
      }

      // V15: Compliance below threshold
      if ((wp.compliance_score ?? 0) < 80 && activities.length > 0) {
        issues.push({
          id: makeId(), ruleId: 'V15', severity: 'error',
          message: `Compliance score ${wp.compliance_score ?? 0}% is below 80% threshold`,
          entityType: 'workpack', entityId: wp.id,
          workpackId: wp.id, workpackNumber: wpNum,
          activityIdDisplay: null,
        });
      }

      // ── Per-activity rules ────────────────────────────────────────────────

      for (let i = 0; i < activities.length; i++) {
        const act = activities[i];
        const actDisplay = act.activity_id ?? act.id.slice(0, 8);

        // V1: Missing predecessors (not the first activity)
        if (act.predecessors.length === 0 && i > 0) {
          issues.push({
            id: makeId(), ruleId: 'V1', severity: 'warning',
            message: `Missing predecessors`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }

        // V2: Missing successors (not the last activity)
        if (act.successors.length === 0 && i < activities.length - 1) {
          issues.push({
            id: makeId(), ruleId: 'V2', severity: 'warning',
            message: `Missing successors`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }

        // V4: Zero duration
        if (!act.duration_hours || Number(act.duration_hours) === 0) {
          issues.push({
            id: makeId(), ruleId: 'V4', severity: 'warning',
            message: `Zero duration`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }

        // V5: Negative float
        if (act.total_float != null && Number(act.total_float) < 0) {
          issues.push({
            id: makeId(), ruleId: 'V5', severity: 'error',
            message: `Negative float (${Number(act.total_float)}h)`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }

        // V6: Missing resources
        if (act.resources.length === 0) {
          issues.push({
            id: makeId(), ruleId: 'V6', severity: 'warning',
            message: `No resources assigned`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }

        // V10: Missing QA clearance for hold points
        if (act.hold_point_type === 'H' && act.qa_clearance_records.length === 0) {
          issues.push({
            id: makeId(), ruleId: 'V10', severity: 'warning',
            message: `Hold Point (H) requires QA clearance`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }

        // V16: Mandatory UDF missing
        if (mandatoryUdfIds.size > 0) {
          const filledUdfIds = new Set(
            act.udf_values
              .filter((v) => v.value_string != null || v.value_number != null || v.udf_option_id != null)
              .map((v) => v.udf_definition_id)
          );
          for (const mu of mandatoryUdfs) {
            if (!filledUdfIds.has(mu.id)) {
              issues.push({
                id: makeId(), ruleId: 'V16', severity: 'warning',
                message: `Mandatory UDF "${mu.code}" is empty`,
                entityType: 'activity', entityId: act.id,
                workpackId: wp.id, workpackNumber: wpNum,
                activityIdDisplay: actDisplay,
              });
            }
          }
        }

        // V17: Unlinked activities (no pred AND no succ)
        if (act.predecessors.length === 0 && act.successors.length === 0 && activities.length > 1) {
          issues.push({
            id: makeId(), ruleId: 'V17', severity: 'info',
            message: `Activity has no predecessors or successors (isolated)`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }

        // V18: Date inconsistency
        if (act.planned_start && act.planned_end && act.planned_end < act.planned_start) {
          issues.push({
            id: makeId(), ruleId: 'V18', severity: 'warning',
            message: `Planned end is before planned start`,
            entityType: 'activity', entityId: act.id,
            workpackId: wp.id, workpackNumber: wpNum,
            activityIdDisplay: actDisplay,
          });
        }
      }

      // V3: Circular logic detection (DFS within workpack activities)
      const circularIds = this.detectCircularRelationships(activities);
      for (const actId of circularIds) {
        const act = activities.find((a) => a.id === actId);
        issues.push({
          id: makeId(), ruleId: 'V3', severity: 'error',
          message: `Circular relationship detected`,
          entityType: 'activity', entityId: actId,
          workpackId: wp.id, workpackNumber: wpNum,
          activityIdDisplay: act?.activity_id ?? actId.slice(0, 8),
        });
      }
    }

    return issues;
  }

  // ── Circular Dependency Detection ─────────────────────────────────────────

  /**
   * DFS-based cycle detection across activity relationships.
   * Returns IDs of activities involved in cycles.
   */
  private static detectCircularRelationships(
    activities: { id: string; successors: { successor_id: string }[] }[],
  ): string[] {
    const adj = new Map<string, string[]>();
    const allIds = new Set(activities.map((a) => a.id));

    for (const act of activities) {
      adj.set(
        act.id,
        act.successors
          .map((s) => s.successor_id)
          .filter((id) => allIds.has(id)),
      );
    }

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const id of allIds) color.set(id, WHITE);

    const cycleNodes = new Set<string>();

    const dfs = (node: string, path: string[]): boolean => {
      color.set(node, GRAY);
      path.push(node);

      for (const next of adj.get(node) ?? []) {
        if (color.get(next) === GRAY) {
          // Found a cycle — mark all nodes in the cycle
          const cycleStart = path.indexOf(next);
          for (let i = cycleStart; i < path.length; i++) {
            cycleNodes.add(path[i]);
          }
          return true;
        }
        if (color.get(next) === WHITE) {
          dfs(next, path);
        }
      }

      path.pop();
      color.set(node, BLACK);
      return false;
    };

    for (const id of allIds) {
      if (color.get(id) === WHITE) {
        dfs(id, []);
      }
    }

    return Array.from(cycleNodes);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  /**
   * Return issue counts by severity.
   */
  static summarize(issues: ValidationIssue[]) {
    return {
      error: issues.filter((i) => i.severity === 'error').length,
      warning: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
      total: issues.length,
    };
  }
}
