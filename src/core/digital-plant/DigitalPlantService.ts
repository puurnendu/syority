/**
 * DigitalPlantService — CRUD for Digital Plant projects.
 * A project scopes AI extraction work to a Unit/System in the hierarchy.
 * M7.1 — Digital Plant Builder.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import type { PlantProjectStatus } from '@prisma/client';

// ── Types ──────────────────────────────────────────

export type CreateProjectInput = {
  organizationId: string;
  siteId: string;
  plantId: string;
  areaId?: string;
  unitId: string;
  systemId?: string;
  name: string;
  description?: string;
  createdBy: string;
};

export type ListProjectsInput = {
  organizationId: string;
  siteId?: string;
  status?: PlantProjectStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ProjectWithStats = {
  id: string;
  name: string;
  description: string | null;
  status: PlantProjectStatus;
  site_name: string;
  plant_name: string;
  unit_name: string;
  system_name: string | null;
  total_documents: number;
  total_candidates: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  created_at: Date;
};

// ── Service ────────────────────────────────────────

export class DigitalPlantService {
  /**
   * Create a new Digital Plant project.
   */
  static async createProject(input: CreateProjectInput) {
    return prisma.digitalPlantProject.create({
      data: {
        id: randomUUID(),
        organization_id: input.organizationId,
        site_id: input.siteId,
        plant_id: input.plantId,
        area_id: input.areaId || null,
        unit_id: input.unitId,
        system_id: input.systemId || null,
        name: input.name,
        description: input.description || null,
        created_by: input.createdBy,
      },
    });
  }

  /**
   * List projects with hierarchy names and stats.
   */
  static async listProjects(input: ListProjectsInput) {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 25, 100);

    const where: any = {
      organization_id: input.organizationId,
      deleted_at: null,
    };
    if (input.siteId) where.site_id = input.siteId;
    if (input.status) where.status = input.status;
    if (input.search) {
      where.name = { contains: input.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.digitalPlantProject.findMany({
        where,
        include: {
          Site: { select: { name: true } },
          Plant: { select: { name: true } },
          Unit: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.digitalPlantProject.count({ where }),
    ]);

    const projects: ProjectWithStats[] = items.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      site_name: p.Site.name,
      plant_name: p.Plant.name,
      unit_name: p.Unit.name,
      system_name: null, // loaded separately if needed
      total_documents: p.total_documents,
      total_candidates: p.total_candidates,
      approved_count: p.approved_count,
      rejected_count: p.rejected_count,
      pending_count: p.total_candidates - p.approved_count - p.rejected_count,
      created_at: p.created_at,
    }));

    return { data: projects, total, page, pageSize };
  }

  /**
   * Get a single project with full details.
   */
  static async getProject(organizationId: string, projectId: string) {
    const project = await prisma.digitalPlantProject.findFirst({
      where: { id: projectId, organization_id: organizationId, deleted_at: null },
      include: {
        Site: { select: { id: true, name: true, code: true } },
        Plant: { select: { id: true, name: true, code: true } },
        Unit: { select: { id: true, name: true, code: true } },
      },
    });
    if (!project) return null;

    // Get live candidate counts
    const [pending, approved, rejected] = await Promise.all([
      prisma.extractionCandidate.count({ where: { project_id: projectId, status: 'pending_review' } }),
      prisma.extractionCandidate.count({ where: { project_id: projectId, status: 'approved' } }),
      prisma.extractionCandidate.count({ where: { project_id: projectId, status: 'rejected' } }),
    ]);

    return {
      ...project,
      live_stats: { pending, approved, rejected, total: pending + approved + rejected },
    };
  }

  /**
   * Update project name, description, or status.
   */
  static async updateProject(
    organizationId: string,
    projectId: string,
    data: { name?: string; description?: string; status?: PlantProjectStatus },
    userId: string
  ) {
    return prisma.digitalPlantProject.updateMany({
      where: { id: projectId, organization_id: organizationId, deleted_at: null },
      data: { ...data, updated_by: userId },
    });
  }

  /**
   * Soft-delete a project (only if no approved assets).
   */
  static async deleteProject(organizationId: string, projectId: string) {
    const approvedCount = await prisma.extractionCandidate.count({
      where: { project_id: projectId, status: 'approved' },
    });
    if (approvedCount > 0) {
      throw new Error(`Cannot delete project with ${approvedCount} approved assets. Archive it instead.`);
    }

    return prisma.digitalPlantProject.updateMany({
      where: { id: projectId, organization_id: organizationId },
      data: { deleted_at: new Date() },
    });
  }

  /**
   * Increment project counters atomically.
   */
  static async incrementCounters(
    projectId: string,
    field: 'total_documents' | 'total_candidates' | 'approved_count' | 'rejected_count',
    amount: number = 1
  ) {
    return prisma.digitalPlantProject.update({
      where: { id: projectId },
      data: { [field]: { increment: amount } },
    });
  }
}
