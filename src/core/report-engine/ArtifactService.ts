/**
 * M7.6B — Report Artifact Service
 *
 * Manages generated report output files.
 * Supports: store, download, re-send, retention, expiration.
 */

import { prisma } from '@/lib/prisma';

const DEFAULT_RETENTION_DAYS = 90;
const CONTENT_TYPE_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  html: 'text/html',
  csv: 'text/csv',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export class ArtifactService {
  /**
   * Store a generated report as an artifact.
   */
  static async store(opts: {
    organizationId: string;
    generationId: string;
    definitionId: string;
    filename: string;
    outputFormat: string;
    htmlContent?: string | null;
    fileData?: Buffer | null;
    filePath?: string | null;
    recordCount?: number;
    pageCount?: number;
    createdBy: string;
    retentionDays?: number;
  }) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (opts.retentionDays ?? DEFAULT_RETENTION_DAYS));

    const fileSizeBytes = opts.fileData
      ? opts.fileData.length
      : opts.htmlContent
        ? Buffer.byteLength(opts.htmlContent, 'utf-8')
        : null;

    return prisma.report_artifacts.create({
      data: {
        organization_id: opts.organizationId,
        generation_id: opts.generationId,
        definition_id: opts.definitionId,
        filename: opts.filename,
        content_type: CONTENT_TYPE_MAP[opts.outputFormat] ?? 'application/octet-stream',
        file_size_bytes: fileSizeBytes,
        file_data: opts.fileData,
        file_path: opts.filePath,
        html_snapshot: opts.htmlContent,
        output_format: opts.outputFormat,
        record_count: opts.recordCount,
        page_count: opts.pageCount,
        expires_at: expiresAt,
        created_by: opts.createdBy,
      },
    });
  }

  /**
   * List artifacts for an organization with pagination.
   */
  static async list(organizationId: string, opts?: {
    definitionId?: string;
    page?: number;
    pageSize?: number;
    includeArchived?: boolean;
  }) {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 25;

    const where: any = {
      organization_id: organizationId,
      ...(opts?.includeArchived ? {} : { is_archived: false }),
      ...(opts?.definitionId ? { definition_id: opts.definitionId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.report_artifacts.findMany({
        where,
        select: {
          id: true, filename: true, content_type: true, file_size_bytes: true,
          output_format: true, record_count: true, page_count: true,
          download_count: true, is_archived: true, expires_at: true, created_at: true,
          generation: {
            select: {
              id: true, status: true, resolved_subject: true,
              definition: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.report_artifacts.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * Get artifact for download. Increments download counter.
   */
  static async getForDownload(id: string) {
    const artifact = await prisma.report_artifacts.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, filename: true, content_type: true,
        file_data: true, file_path: true, html_snapshot: true,
        output_format: true,
      },
    });

    // Increment download count
    await prisma.report_artifacts.update({
      where: { id },
      data: {
        download_count: { increment: 1 },
        last_downloaded_at: new Date(),
      },
    });

    return artifact;
  }

  /**
   * Re-send an artifact via the notification platform.
   * Returns the notification queue item IDs.
   */
  static async resend(id: string, recipients: Array<{ email: string; name?: string }>, subject?: string): Promise<string[]> {
    const artifact = await prisma.report_artifacts.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, filename: true, organization_id: true, html_snapshot: true,
        generation: { select: { resolved_subject: true, definition: { select: { name: true } } } },
      },
    });

    const queueIds: string[] = [];
    const emailSubject = subject ?? artifact.generation?.resolved_subject ?? `Report: ${artifact.generation?.definition.name ?? artifact.filename}`;
    const body = artifact.html_snapshot ?? `<p>Your report "${artifact.filename}" is attached.</p>`;

    for (const r of recipients) {
      const item = await prisma.notification_queue.create({
        data: {
          channel: 'email',
          recipient_email: r.email,
          recipient_name: r.name,
          subject: emailSubject,
          html_body: body,
          text_body: `Your report "${artifact.filename}" is ready.`,
          status: 'pending',
          priority: 5,
          max_attempts: 3,
          organization_id: artifact.organization_id,
          event_type: 'report.resent',
          entity_type: 'ReportArtifact',
          entity_id: artifact.id,
        },
      });
      queueIds.push(item.id);
    }

    // Update last_resent_at
    await prisma.report_artifacts.update({
      where: { id },
      data: { last_resent_at: new Date() },
    });

    return queueIds;
  }

  /**
   * Soft-delete (archive) an artifact.
   */
  static async archive(id: string) {
    return prisma.report_artifacts.update({
      where: { id },
      data: { is_archived: true },
    });
  }

  /**
   * Hard-delete an artifact.
   */
  static async delete(id: string) {
    return prisma.report_artifacts.delete({ where: { id } });
  }

  /**
   * Cleanup expired artifacts. Intended for periodic jobs.
   */
  static async cleanupExpired(): Promise<number> {
    const result = await prisma.report_artifacts.deleteMany({
      where: { expires_at: { lt: new Date() }, is_archived: false },
    });
    return result.count;
  }
}
