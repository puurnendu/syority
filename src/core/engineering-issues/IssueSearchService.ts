/**
 * IssueSearchService — Cross-entity search + dashboard stats.
 * M7.2 — Engineering Scope Intelligence.
 */

import { prisma } from '@/lib/prisma';

// ── Types ──────────────────────────────────────────

export type SearchInput = {
  organizationId: string;
  query?: string;
  department?: string;
  discipline?: string;
  priority?: string;
  status?: string;
  equipmentTag?: string;
  assetId?: string;
  unitId?: string;
  systemId?: string;
  failureMode?: string;
  batchId?: string;
  page?: number;
  pageSize?: number;
};

export type DashboardStats = {
  total: number;
  matched: number;
  unmatched: number;
  pending_review: number;
  duplicates: number;
  resolved: number;
  rejected: number;
  by_department: Array<{ department: string | null; count: number }>;
  by_discipline: Array<{ discipline: string | null; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
  by_unit: Array<{ unit_id: string | null; unit_name: string | null; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  recent_batches: Array<{
    id: string;
    name: string;
    source_type: string;
    total_rows: number;
    created_at: Date;
  }>;
};

// ── Service ────────────────────────────────────────

export class IssueSearchService {
  /**
   * Full-text search across issues.
   */
  static async search(input: SearchInput) {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 50, 100);

    const where: any = {
      organization_id: input.organizationId,
      deleted_at: null,
    };

    if (input.query) {
      where.OR = [
        { problem: { contains: input.query, mode: 'insensitive' } },
        { recommendation: { contains: input.query, mode: 'insensitive' } },
        { equipment_tag_raw: { contains: input.query, mode: 'insensitive' } },
        { issue_number: { contains: input.query, mode: 'insensitive' } },
        { originator: { contains: input.query, mode: 'insensitive' } },
        { comments: { contains: input.query, mode: 'insensitive' } },
        { ai_failure_mode: { contains: input.query, mode: 'insensitive' } },
      ];
    }

    if (input.department) where.department = input.department;
    if (input.discipline) where.discipline = input.discipline;
    if (input.priority) where.priority = input.priority;
    if (input.status) where.status = input.status;
    if (input.assetId) where.asset_id = input.assetId;
    if (input.unitId) where.unit_id = input.unitId;
    if (input.systemId) where.system_id = input.systemId;
    if (input.batchId) where.batch_id = input.batchId;
    if (input.failureMode) where.ai_failure_mode = { contains: input.failureMode, mode: 'insensitive' };
    if (input.equipmentTag) where.equipment_tag_raw = { contains: input.equipmentTag, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      prisma.engineeringIssue.findMany({
        where,
        include: {
          asset: { select: { id: true, tag_number: true, name: true, asset_type: true } },
          batch: { select: { id: true, name: true, source_department: true } },
        },
        orderBy: [{ priority: 'asc' }, { created_at: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.engineeringIssue.count({ where }),
    ]);

    return { data: items, total, page, pageSize };
  }

  /**
   * Dashboard aggregate statistics.
   */
  static async getDashboardStats(organizationId: string): Promise<DashboardStats> {
    const baseWhere = { organization_id: organizationId, deleted_at: null };

    const [
      total,
      byStatus,
      byDepartment,
      byDiscipline,
      byPriority,
      byUnit,
      recentBatches,
    ] = await Promise.all([
      prisma.engineeringIssue.count({ where: baseWhere }),

      prisma.engineeringIssue.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),

      prisma.engineeringIssue.groupBy({
        by: ['department'],
        where: { ...baseWhere, department: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      prisma.engineeringIssue.groupBy({
        by: ['discipline'],
        where: { ...baseWhere, discipline: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      prisma.engineeringIssue.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { id: true },
      }),

      prisma.engineeringIssue.groupBy({
        by: ['unit_id'],
        where: { ...baseWhere, unit_id: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      prisma.issueBatch.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true, source_type: true, total_rows: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count.id]));

    // Resolve unit names
    const unitIds = byUnit.map((u) => u.unit_id).filter(Boolean) as string[];
    const units = unitIds.length > 0
      ? await prisma.unit.findMany({
          where: { id: { in: unitIds } },
          select: { id: true, name: true },
        })
      : [];
    const unitNameMap = new Map(units.map((u) => [u.id, u.name]));

    return {
      total,
      matched: statusMap['matched'] || 0,
      unmatched: statusMap['unmatched'] || 0,
      pending_review: statusMap['pending_review'] || 0,
      duplicates: statusMap['duplicate'] || 0,
      resolved: statusMap['resolved'] || 0,
      rejected: statusMap['rejected'] || 0,
      by_department: byDepartment.map((d) => ({ department: d.department, count: d._count.id })),
      by_discipline: byDiscipline.map((d) => ({ discipline: d.discipline, count: d._count.id })),
      by_priority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
      by_unit: byUnit.map((u) => ({
        unit_id: u.unit_id,
        unit_name: unitNameMap.get(u.unit_id!) || null,
        count: u._count.id,
      })),
      by_status: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      recent_batches: recentBatches,
    };
  }
}
