/**
 * IssueBatchService — Import batch lifecycle.
 * M7.2 — Engineering Scope Intelligence.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

// ── Types ──────────────────────────────────────────

export const SOURCE_TYPES = [
  'excel', 'csv', 'pdf', 'word', 'email', 'whatsapp',
  'api', 'cmms', 'sap', 'maximo', 'manual', 'inspection',
] as const;

export type SourceType = typeof SOURCE_TYPES[number];

export type CreateBatchInput = {
  organizationId: string;
  siteId?: string;
  name: string;
  description?: string;
  sourceType: SourceType;
  sourceFilename?: string;
  sourceDepartment?: string;
  uploadedBy: string;
  columnMappingId?: string;
  aiExtractionUsed?: boolean;
};

export type ListBatchesInput = {
  organizationId: string;
  sourceType?: SourceType;
  sourceDepartment?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

// ── Service ────────────────────────────────────────

export class IssueBatchService {
  /**
   * Create a new import batch.
   */
  static async createBatch(input: CreateBatchInput) {
    return prisma.issueBatch.create({
      data: {
        id: randomUUID(),
        organization_id: input.organizationId,
        site_id: input.siteId || null,
        name: input.name,
        description: input.description || null,
        source_type: input.sourceType,
        source_filename: input.sourceFilename || null,
        source_department: input.sourceDepartment || null,
        uploaded_by: input.uploadedBy,
        column_mapping_id: input.columnMappingId || null,
        ai_extraction_used: input.aiExtractionUsed || false,
        status: 'pending',
      },
    });
  }

  /**
   * List batches with pagination.
   */
  static async listBatches(input: ListBatchesInput) {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 25, 100);

    const where: any = {
      organization_id: input.organizationId,
      deleted_at: null,
    };
    if (input.sourceType) where.source_type = input.sourceType;
    if (input.sourceDepartment) where.source_department = input.sourceDepartment;
    if (input.status) where.status = input.status;
    if (input.search) {
      where.name = { contains: input.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.issueBatch.findMany({
        where,
        include: {
          _count: { select: { issues: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.issueBatch.count({ where }),
    ]);

    return { data: items, total, page, pageSize };
  }

  /**
   * Get a batch with live stats.
   */
  static async getBatch(organizationId: string, batchId: string) {
    const batch = await prisma.issueBatch.findFirst({
      where: { id: batchId, organization_id: organizationId, deleted_at: null },
    });
    if (!batch) return null;

    const [total, byStatus, byDept, byPriority] = await Promise.all([
      prisma.engineeringIssue.count({ where: { batch_id: batchId, deleted_at: null } }),
      prisma.engineeringIssue.groupBy({
        by: ['status'],
        where: { batch_id: batchId, deleted_at: null },
        _count: { id: true },
      }),
      prisma.engineeringIssue.groupBy({
        by: ['department'],
        where: { batch_id: batchId, deleted_at: null, department: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.engineeringIssue.groupBy({
        by: ['priority'],
        where: { batch_id: batchId, deleted_at: null },
        _count: { id: true },
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count.id]));

    return {
      ...batch,
      live_stats: {
        total,
        matched: statusMap['matched'] || 0,
        unmatched: statusMap['unmatched'] || 0,
        pending_review: statusMap['pending_review'] || 0,
        duplicate: statusMap['duplicate'] || 0,
        resolved: statusMap['resolved'] || 0,
        rejected: statusMap['rejected'] || 0,
        draft: statusMap['draft'] || 0,
      },
      by_department: byDept.map((d) => ({ department: d.department, count: d._count.id })),
      by_priority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
    };
  }

  /**
   * Rollback a batch — deletes all issues from the batch.
   */
  static async rollbackBatch(organizationId: string, batchId: string, userId: string) {
    const batch = await prisma.issueBatch.findFirst({
      where: { id: batchId, organization_id: organizationId, deleted_at: null },
    });
    if (!batch) throw new Error('Batch not found');
    if (batch.status === 'rolled_back') throw new Error('Batch already rolled back');

    // Check for resolved issues — they cannot be rolled back
    const resolvedCount = await prisma.engineeringIssue.count({
      where: { batch_id: batchId, status: 'resolved', deleted_at: null },
    });
    if (resolvedCount > 0) {
      throw new Error(`Cannot rollback: ${resolvedCount} issues are already resolved. Archive the batch instead.`);
    }

    // Soft-delete all issues in the batch
    const result = await prisma.engineeringIssue.updateMany({
      where: { batch_id: batchId, deleted_at: null },
      data: { deleted_at: new Date(), updated_by: userId },
    });

    // Update batch status
    await prisma.issueBatch.update({
      where: { id: batchId },
      data: { status: 'rolled_back' },
    });

    return { batch_id: batchId, issues_deleted: result.count };
  }

  /**
   * Update batch counters atomically.
   */
  static async updateCounters(
    batchId: string,
    field: 'total_rows' | 'matched_count' | 'unmatched_count' | 'duplicate_count' | 'error_count',
    amount: number = 1
  ) {
    return prisma.issueBatch.update({
      where: { id: batchId },
      data: { [field]: { increment: amount } },
    });
  }
}
