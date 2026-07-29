/**
 * IssueService — CRUD for Engineering Issues.
 * M7.2 — Engineering Scope Intelligence.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import type { IssueStatus, IssuePriority } from '@prisma/client';

// ── Types ──────────────────────────────────────────

export type CreateIssueInput = {
  organizationId: string;
  siteId?: string;
  batchId?: string;
  issueNumber?: string;
  equipmentTagRaw?: string;
  equipmentDescRaw?: string;
  department?: string;
  problem: string;
  recommendation?: string;
  priority?: IssuePriority;
  severity?: string;
  targetTa?: string;
  originator?: string;
  raisedDate?: string;
  dueDate?: string;
  comments?: string;
  createdBy?: string;
};

export type ListIssuesInput = {
  organizationId: string;
  siteId?: string;
  batchId?: string;
  assetId?: string;
  status?: IssueStatus;
  department?: string;
  discipline?: string;
  priority?: IssuePriority;
  equipmentTag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type UpdateIssueInput = {
  problem?: string;
  recommendation?: string;
  priority?: IssuePriority;
  severity?: string;
  department?: string;
  discipline?: string;
  targetTa?: string;
  originator?: string;
  comments?: string;
  status?: IssueStatus;
};

// ── Service ────────────────────────────────────────

export class IssueService {
  /**
   * Create a single engineering issue (manual entry).
   */
  static async createIssue(input: CreateIssueInput) {
    const issue = await prisma.engineeringIssue.create({
      data: {
        id: randomUUID(),
        organization_id: input.organizationId,
        site_id: input.siteId || null,
        batch_id: input.batchId || null,
        issue_number: input.issueNumber || null,
        equipment_tag_raw: input.equipmentTagRaw || null,
        equipment_desc_raw: input.equipmentDescRaw || null,
        department: input.department || null,
        problem: input.problem,
        recommendation: input.recommendation || null,
        priority: input.priority || 'unclassified',
        severity: input.severity || null,
        target_ta: input.targetTa || null,
        originator: input.originator || null,
        raised_date: input.raisedDate ? new Date(input.raisedDate) : null,
        due_date: input.dueDate ? new Date(input.dueDate) : null,
        comments: input.comments || null,
        status: 'draft',
        created_by: input.createdBy || null,
      },
    });

    // Audit log
    await prisma.issueAuditLog.create({
      data: {
        id: randomUUID(),
        issue_id: issue.id,
        user_id: input.createdBy || null,
        action: 'create',
        new_value: input.problem.substring(0, 200),
      },
    });

    return issue;
  }

  /**
   * List issues with filtering and pagination.
   */
  static async listIssues(input: ListIssuesInput) {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 50, 100);

    const where: any = {
      organization_id: input.organizationId,
      deleted_at: null,
    };
    if (input.siteId) where.site_id = input.siteId;
    if (input.batchId) where.batch_id = input.batchId;
    if (input.assetId) where.asset_id = input.assetId;
    if (input.status) where.status = input.status;
    if (input.department) where.department = input.department;
    if (input.discipline) where.discipline = input.discipline;
    if (input.priority) where.priority = input.priority;
    if (input.equipmentTag) {
      where.equipment_tag_raw = { contains: input.equipmentTag, mode: 'insensitive' };
    }
    if (input.search) {
      where.OR = [
        { problem: { contains: input.search, mode: 'insensitive' } },
        { equipment_tag_raw: { contains: input.search, mode: 'insensitive' } },
        { issue_number: { contains: input.search, mode: 'insensitive' } },
        { recommendation: { contains: input.search, mode: 'insensitive' } },
        { originator: { contains: input.search, mode: 'insensitive' } },
        { comments: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.engineeringIssue.findMany({
        where,
        include: {
          asset: { select: { id: true, tag_number: true, name: true, asset_type: true } },
          batch: { select: { id: true, name: true, source_type: true, source_department: true } },
          _count: { select: { attachments: true, duplicates_as_a: true, duplicates_as_b: true } },
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
   * Get a single issue with full relations.
   */
  static async getIssue(organizationId: string, issueId: string) {
    return prisma.engineeringIssue.findFirst({
      where: { id: issueId, organization_id: organizationId, deleted_at: null },
      include: {
        asset: { select: { id: true, tag_number: true, name: true, asset_type: true, description: true } },
        batch: { select: { id: true, name: true, source_type: true, source_department: true } },
        attachments: { orderBy: { created_at: 'desc' } },
        audit_logs: { orderBy: { created_at: 'desc' }, take: 50 },
        classifications: { orderBy: { confidence: 'desc' } },
        duplicates_as_a: { include: { issue_b: { select: { id: true, issue_number: true, problem: true, equipment_tag_raw: true } } } },
        duplicates_as_b: { include: { issue_a: { select: { id: true, issue_number: true, problem: true, equipment_tag_raw: true } } } },
      },
    });
  }

  /**
   * Update an issue.
   */
  static async updateIssue(
    organizationId: string,
    issueId: string,
    data: UpdateIssueInput,
    userId: string
  ) {
    const existing = await prisma.engineeringIssue.findFirst({
      where: { id: issueId, organization_id: organizationId, deleted_at: null },
    });
    if (!existing) throw new Error('Issue not found');

    // Track changes for audit
    const changes: Array<{ field: string; old: string; new_val: string }> = [];
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        const oldVal = String((existing as any)[key] ?? '');
        const newVal = String(val);
        if (oldVal !== newVal) changes.push({ field: key, old: oldVal, new_val: newVal });
      }
    }

    await prisma.engineeringIssue.update({
      where: { id: issueId },
      data: { ...data, updated_by: userId },
    });

    // Audit logs for each changed field
    for (const change of changes) {
      await prisma.issueAuditLog.create({
        data: {
          id: randomUUID(),
          issue_id: issueId,
          user_id: userId,
          action: 'update',
          field_name: change.field,
          old_value: change.old.substring(0, 500),
          new_value: change.new_val.substring(0, 500),
        },
      });
    }

    return { id: issueId, fields_changed: changes.length };
  }

  /**
   * Soft-delete an issue.
   */
  static async deleteIssue(organizationId: string, issueId: string, userId: string) {
    await prisma.engineeringIssue.updateMany({
      where: { id: issueId, organization_id: organizationId },
      data: { deleted_at: new Date(), updated_by: userId },
    });

    await prisma.issueAuditLog.create({
      data: {
        id: randomUUID(),
        issue_id: issueId,
        user_id: userId,
        action: 'resolve',
        notes: 'Soft-deleted',
      },
    });

    return { id: issueId, deleted: true };
  }

  /**
   * Get distinct departments for filter dropdowns.
   */
  static async getDepartments(organizationId: string) {
    const result = await prisma.engineeringIssue.groupBy({
      by: ['department'],
      where: { organization_id: organizationId, deleted_at: null, department: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    return result.map((r) => ({ department: r.department, count: r._count.id }));
  }
}
