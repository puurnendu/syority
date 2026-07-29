/**
 * PlantDocumentService — Upload, version, and manage engineering documents.
 * Documents are permanent (not event-scoped like DocLibrary).
 * M7.1 — Digital Plant Builder.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { DigitalPlantService } from './DigitalPlantService';

// ── Types ──────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'P&ID', 'PFD', 'GA Drawing', 'Equipment Layout', 'Isometric',
  'OEM Manual', 'Datasheet', 'Line List', 'Valve List',
  'Instrument Index', 'Equipment List', 'Cable Schedule',
  'Loop Drawing', 'Inspection Report', 'Photo', 'Vendor Manual', 'Other',
] as const;

export const DISCIPLINES = [
  'Mechanical', 'Piping', 'Electrical', 'Instrumentation',
  'Civil', 'Process', 'Structural', 'General',
] as const;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/tiff', 'image/tif',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // DWG placeholder
];

export type UploadDocumentInput = {
  organizationId: string;
  projectId: string;
  file: File;
  documentType: string;
  title: string;
  drawingNumber?: string;
  revision?: string;
  issueDate?: string;
  discipline?: string;
  unitId?: string;
  systemId?: string;
  uploadedBy: string;
};

export type ListDocumentsInput = {
  organizationId: string;
  projectId: string;
  documentType?: string;
  discipline?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

// ── Storage helper ─────────────────────────────────

const UPLOAD_BASE = path.join(process.cwd(), 'uploads', 'digital-plant');

async function storeFile(orgId: string, projectId: string, file: File): Promise<{
  storedFilename: string;
  storagePath: string;
  fileSize: number;
}> {
  const dir = path.join(UPLOAD_BASE, orgId, projectId);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || '.bin';
  const storedFilename = `${randomUUID()}${ext}`;
  const storagePath = path.join(dir, storedFilename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(storagePath, buffer);

  return { storedFilename, storagePath, fileSize: buffer.length };
}

// ── Service ────────────────────────────────────────

export class PlantDocumentService {
  /**
   * Upload a new engineering document to a project.
   */
  static async uploadDocument(input: UploadDocumentInput) {
    const { storedFilename, storagePath, fileSize } = await storeFile(
      input.organizationId, input.projectId, input.file
    );

    const doc = await prisma.plantDocument.create({
      data: {
        id: randomUUID(),
        organization_id: input.organizationId,
        project_id: input.projectId,
        document_type: input.documentType,
        title: input.title,
        drawing_number: input.drawingNumber || null,
        revision: input.revision || '0',
        issue_date: input.issueDate ? new Date(input.issueDate) : null,
        discipline: input.discipline || null,
        unit_id: input.unitId || null,
        system_id: input.systemId || null,
        original_filename: input.file.name,
        stored_filename: storedFilename,
        storage_path: storagePath,
        mime_type: input.file.type || null,
        file_size_bytes: BigInt(fileSize),
        uploaded_by: input.uploadedBy,
      },
    });

    // Increment project document counter
    await DigitalPlantService.incrementCounters(input.projectId, 'total_documents');

    return doc;
  }

  /**
   * List documents for a project with filtering.
   */
  static async listDocuments(input: ListDocumentsInput) {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 50, 100);

    const where: any = {
      organization_id: input.organizationId,
      project_id: input.projectId,
      deleted_at: null,
    };
    if (input.documentType) where.document_type = input.documentType;
    if (input.discipline) where.discipline = input.discipline;
    if (input.status) where.status = input.status;
    if (input.search) {
      where.OR = [
        { title: { contains: input.search, mode: 'insensitive' } },
        { drawing_number: { contains: input.search, mode: 'insensitive' } },
        { original_filename: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.plantDocument.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          document_type: true,
          drawing_number: true,
          title: true,
          revision: true,
          issue_date: true,
          discipline: true,
          status: true,
          original_filename: true,
          mime_type: true,
          file_size_bytes: true,
          version_number: true,
          uploaded_by: true,
          created_at: true,
          _count: { select: { candidates: true } },
        },
      }),
      prisma.plantDocument.count({ where }),
    ]);

    return {
      data: items.map((d) => ({
        ...d,
        file_size_bytes: d.file_size_bytes ? Number(d.file_size_bytes) : 0,
        candidate_count: d._count.candidates,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get a single document with extraction status.
   */
  static async getDocument(organizationId: string, documentId: string) {
    return prisma.plantDocument.findFirst({
      where: { id: documentId, organization_id: organizationId, deleted_at: null },
      include: {
        candidates: {
          select: { id: true, status: true, candidate_type: true, tag_number: true, confidence_score: true },
          orderBy: { confidence_score: 'desc' },
        },
        asset_links: {
          include: { asset: { select: { id: true, tag_number: true, name: true } } },
        },
      },
    });
  }

  /**
   * Update document metadata.
   */
  static async updateDocument(
    organizationId: string,
    documentId: string,
    data: { title?: string; drawingNumber?: string; revision?: string; discipline?: string; status?: string }
  ) {
    return prisma.plantDocument.updateMany({
      where: { id: documentId, organization_id: organizationId, deleted_at: null },
      data: {
        title: data.title,
        drawing_number: data.drawingNumber,
        revision: data.revision,
        discipline: data.discipline,
        status: data.status,
      },
    });
  }

  /**
   * Create a new version of an existing document.
   */
  static async createNewVersion(
    organizationId: string,
    existingDocId: string,
    file: File,
    revision: string,
    uploadedBy: string
  ) {
    const existing = await prisma.plantDocument.findFirst({
      where: { id: existingDocId, organization_id: organizationId, deleted_at: null },
    });
    if (!existing) throw new Error('Document not found');

    const { storedFilename, storagePath, fileSize } = await storeFile(
      organizationId, existing.project_id, file
    );

    return prisma.plantDocument.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        project_id: existing.project_id,
        document_type: existing.document_type,
        title: existing.title,
        drawing_number: existing.drawing_number,
        revision,
        discipline: existing.discipline,
        unit_id: existing.unit_id,
        system_id: existing.system_id,
        original_filename: file.name,
        stored_filename: storedFilename,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size_bytes: BigInt(fileSize),
        version_number: existing.version_number + 1,
        supersedes_id: existingDocId,
        uploaded_by: uploadedBy,
      },
    });
  }

  /**
   * Soft-delete a document (only if no approved candidates).
   */
  static async deleteDocument(organizationId: string, documentId: string) {
    const approved = await prisma.extractionCandidate.count({
      where: { source_document_id: documentId, status: 'approved' },
    });
    if (approved > 0) {
      throw new Error(`Cannot delete document with ${approved} approved candidates.`);
    }

    return prisma.plantDocument.updateMany({
      where: { id: documentId, organization_id: organizationId },
      data: { deleted_at: new Date() },
    });
  }
}
