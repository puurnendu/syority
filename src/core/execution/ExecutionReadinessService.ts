import { prisma } from '@/lib/prisma';
import { PermitService, type PermitReadinessRecord } from '@/modules/Permits/Services/PermitService';
import { MaterialReadinessService } from '@/core/materials/MaterialReadinessService';

export interface ReadinessEvaluation {
  is_ready: boolean;
  blockers: string[];
}

/**
 * M12 execution readiness authority.
 *
 * Bulk evaluation uses the same blocker rules as evaluateReadiness
 * (critical constraints, incomplete predecessors, permits, critical materials,
 * safe isolation) with set-based queries so M13/M15 can consume event-scale
 * not-started lists without N+1.
 *
 * Phase 0 (E2E lineage audit P0-7 / A10 / A11): material and isolation readiness
 * now gate RELEASE/START. Previously only 3 dimensions (constraints,
 * predecessors, permits) were enforced; a critical material shortfall or an
 * unconfirmed safe isolation never blocked execution.
 */
export class ExecutionReadinessService {
  /**
   * Evaluates if an activity is ready for execution (RELEASE/START).
   * This is a READ-ONLY orchestration layer.
   * Derives READY / NOT_READY state based on constraints, predecessors, and permits.
   */
  static async evaluateReadiness(orgId: string, activityId: string): Promise<ReadinessEvaluation> {
    const map = await this.evaluateBulkReadiness(orgId, [activityId]);
    const result = map[activityId];
    if (!result) {
      throw new Error(`Activity ${activityId} not found`);
    }
    return result;
  }

  /**
   * Bulk evaluation for many activities (Control Tower / M15).
   * Same formula as single-activity readiness. Four queries, not N+1.
   */
  static async evaluateBulkReadiness(orgId: string, activityIds: string[]): Promise<Record<string, ReadinessEvaluation>> {
    const results: Record<string, ReadinessEvaluation> = {};
    if (activityIds.length === 0) {
      return results;
    }

    const uniqueIds = [...new Set(activityIds)];

    const activities = await prisma.activity.findMany({
      where: {
        id: { in: uniqueIds },
        organization_id: orgId,
        deleted_at: null,
      },
      select: {
        id: true,
        workpack_id: true,
        activity_number: true,
        description: true,
      },
    });

    const foundIds = new Set(activities.map((a) => a.id));
    if (uniqueIds.length === 1 && !foundIds.has(uniqueIds[0])) {
      throw new Error(`Activity ${uniqueIds[0]} not found`);
    }
    if (activities.length === 0) {
      return results;
    }

    const workpackIds = [
      ...new Set(activities.map((a) => a.workpack_id).filter((id): id is string => Boolean(id))),
    ];

    const [criticalConstraints, predecessorRels, permits, criticalMaterialLines, activeBlinds] = await Promise.all([
      workpackIds.length === 0
        ? Promise.resolve([] as { workpack_id: string | null }[])
        : prisma.constraintLog.findMany({
            where: {
              organization_id: orgId,
              workpack_id: { in: workpackIds },
              severity: 'critical',
              status: { in: ['open', 'in_progress'] },
              deleted_at: null,
            },
            select: { workpack_id: true },
          }),
      prisma.activityRelationship.findMany({
        where: {
          organization_id: orgId,
          successor_id: { in: uniqueIds.filter((id) => foundIds.has(id)) },
        },
        select: {
          successor_id: true,
          predecessor: {
            select: {
              status: true,
              activity_number: true,
              description: true,
              organization_id: true,
            },
          },
        },
      }),
      uniqueIds.length === 0
        ? Promise.resolve([] as PermitReadinessRecord[])
        : prisma.permit.findMany({
            where: {
              organization_id: orgId,
              OR: [
                ...(workpackIds.length > 0 ? [{ workpack_id: { in: workpackIds } }] : []),
                { activity_id: { in: uniqueIds.filter((id) => foundIds.has(id)) } },
              ],
            },
            select: {
              permit_number: true,
              status: true,
              valid_until: true,
              workpack_id: true,
              activity_id: true,
            },
          }),
      // Material readiness dimension (A10): critical material lines on the
      // activity's workpack, evaluated with the same rules as
      // MaterialReadinessService.calculateLineReadiness.
      workpackIds.length === 0
        ? Promise.resolve([] as any[])
        : prisma.workpack_material_lines.findMany({
            where: {
              workpack_id: { in: workpackIds },
              organization_id: orgId,
              deleted_at: null,
              is_critical: true,
            },
            include: {
              supply_records: {
                where: { delivery_status: { not: 'cancelled' } },
              },
            },
          }),
      // Isolation readiness dimension (A11): active blinds on the activity's
      // workpack whose safe isolation is not confirmed. Removed/cancelled
      // blinds no longer represent an isolation requirement.
      workpackIds.length === 0
        ? Promise.resolve([] as any[])
        : prisma.blind.findMany({
            where: {
              workpack_id: { in: workpackIds },
              organization_id: orgId,
              deleted_at: null,
              status: { in: ['pending', 'inserted', 'pressure_tested'] },
            },
            select: {
              workpack_id: true,
              blind_number: true,
              safe_isolation_confirmed: true,
              insert_activity_id: true,
              remove_activity_id: true,
            },
          }),
    ]);

    const blockedWorkpacks = new Set(
      criticalConstraints.map((c) => c.workpack_id).filter((id): id is string => Boolean(id))
    );

    const incompleteBySuccessor = new Map<string, string[]>();
    for (const rel of predecessorRels) {
      const pred = rel.predecessor;
      if (!pred || pred.organization_id !== orgId) continue;
      if (pred.status === 'completed') continue;
      const label = pred.activity_number || pred.description || 'predecessor';
      const list = incompleteBySuccessor.get(rel.successor_id) ?? [];
      list.push(label);
      incompleteBySuccessor.set(rel.successor_id, list);
    }

    const now = new Date();
    const permitsByActivity = new Map<string, PermitReadinessRecord[]>();
    for (const act of activities) {
      const relevant = permits.filter(
        (p) =>
          (act.workpack_id && p.workpack_id === act.workpack_id) ||
          p.activity_id === act.id
      );
      permitsByActivity.set(act.id, relevant);
    }

    // Material readiness per workpack: a critical line that is blocked or
    // not_ready gates every activity in that workpack.
    const materialBlockersByWorkpack = new Map<string, string[]>();
    for (const line of criticalMaterialLines as any[]) {
      const readiness = MaterialReadinessService.calculateLineReadiness({
        id: line.id,
        description: line.description,
        is_critical: line.is_critical,
        quantity_required: line.quantity_required,
        quantity_available: line.quantity_available,
        quantity_on_order: line.quantity_on_order,
        expected_eta: line.expected_eta,
        supply_records: (line.supply_records ?? []).map((sr: any) => ({
          quantity_ordered: sr.quantity_ordered,
          quantity_received: sr.quantity_received,
          expected_delivery: sr.expected_delivery,
          delivery_status: sr.delivery_status,
        })),
      });
      if (readiness.readiness_status === 'blocked' || readiness.readiness_status === 'not_ready') {
        const list = materialBlockersByWorkpack.get(line.workpack_id) ?? [];
        list.push(
          `Critical material not available: ${line.description} (${readiness.readiness_status}` +
            (readiness.constraint_date ? `, ETA ${readiness.constraint_date}` : '') +
            ')'
        );
        materialBlockersByWorkpack.set(line.workpack_id, list);
      }
    }

    // Isolation readiness per workpack: active blinds without confirmed safe
    // isolation gate the workpack's activities — except the activities that
    // perform the isolation insertion/removal themselves.
    type IsolationBlocker = { message: string; insert_activity_id: string | null; remove_activity_id: string | null };
    const isolationBlockersByWorkpack = new Map<string, IsolationBlocker[]>();
    for (const blind of activeBlinds as any[]) {
      if (blind.safe_isolation_confirmed === true) continue;
      const list = isolationBlockersByWorkpack.get(blind.workpack_id) ?? [];
      list.push({
        message: `Safe isolation not confirmed: blind ${blind.blind_number}`,
        insert_activity_id: blind.insert_activity_id ?? null,
        remove_activity_id: blind.remove_activity_id ?? null,
      });
      isolationBlockersByWorkpack.set(blind.workpack_id, list);
    }

    for (const act of activities) {
      const blockers: string[] = [];

      if (act.workpack_id && blockedWorkpacks.has(act.workpack_id)) {
        blockers.push('Workpack has open critical constraints');
      }

      const incomplete = incompleteBySuccessor.get(act.id);
      if (incomplete && incomplete.length > 0) {
        blockers.push(`Predecessor activities not completed (${incomplete.join(', ')})`);
      }

      if (act.workpack_id) {
        const permitBlockers = PermitService.evaluatePermitRecords(
          permitsByActivity.get(act.id) ?? [],
          now
        );
        blockers.push(...permitBlockers);
      }

      if (act.workpack_id) {
        blockers.push(...(materialBlockersByWorkpack.get(act.workpack_id) ?? []));
      }

      if (act.workpack_id) {
        const isolationBlockers = (isolationBlockersByWorkpack.get(act.workpack_id) ?? [])
          // The activity that performs the isolation insertion or removal is
          // not gated by that blind being unconfirmed.
          .filter((b) => b.insert_activity_id !== act.id && b.remove_activity_id !== act.id)
          .map((b) => b.message);
        blockers.push(...isolationBlockers);
      }

      results[act.id] = {
        is_ready: blockers.length === 0,
        blockers,
      };
    }

    return results;
  }
}
