/**
 * Enterprise organization hierarchy:
 * Site → Plant → Area? → Unit → System → Asset
 *
 * All operations are tenant-scoped via organization_id.
 * Codes are unique within their parent scope (not globally).
 * Soft-delete via deleted_at; archive/restore toggle is_active + deleted_at.
 */
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { Prisma } from '@prisma/client';

export type HierarchyEntity =
  | 'site'
  | 'plant'
  | 'area'
  | 'unit'
  | 'system'
  | 'asset';

export type ListParams = {
  organizationId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'archived' | 'all';
  parentId?: string | null;
  siteId?: string;
  plantId?: string;
  areaId?: string;
  unitId?: string;
  systemId?: string;
};

export type HierarchyInput = {
  code?: string | null;
  name: string;
  description?: string | null;
  is_active?: boolean;
  site_id?: string;
  plant_id?: string;
  area_id?: string | null;
  unit_id?: string;
  system_id?: string | null;
  location?: string | null;
  timezone?: string | null;
  /** Asset tag (maps to tag_number); falls back to code */
  tag_number?: string;
  asset_type?: string | null;
};

export class HierarchyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HierarchyConflictError';
  }
}

export class HierarchyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HierarchyNotFoundError';
  }
}

function normalizeCode(code?: string | null): string | null {
  if (code == null) return null;
  const t = String(code).trim();
  return t.length ? t : null;
}

function statusWhere(status?: ListParams['status']): Prisma.SiteWhereInput {
  if (status === 'archived') return { deleted_at: { not: null } };
  if (status === 'inactive') return { deleted_at: null, is_active: false };
  if (status === 'all') return {};
  // default: active (not deleted)
  return { deleted_at: null };
}

function paginate(page = 1, pageSize = 25) {
  const p = Math.max(1, page);
  const take = Math.min(100, Math.max(1, pageSize));
  return { skip: (p - 1) * take, take, page: p, pageSize: take };
}

async function audit(
  orgId: string,
  userId: string,
  action: string,
  model: string,
  id: string,
  oldValues?: unknown,
  newValues?: unknown
) {
  await AuditService.log({
    organization_id: orgId,
    user_id: userId,
    action,
    model_name: model,
    model_id: id,
    old_values: oldValues as Record<string, unknown> | undefined,
    new_values: newValues as Record<string, unknown> | undefined,
  });
}

export class HierarchyService {
  // ── Sites ──────────────────────────────────────────────────────────────

  static async listSites(params: ListParams) {
    const { skip, take, page, pageSize } = paginate(params.page, params.pageSize);
    const where: Prisma.SiteWhereInput = {
      organization_id: params.organizationId,
      ...statusWhere(params.status),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { location: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.site.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { Plant: true, Unit: true, Workpack: true, users: true } },
        },
      }),
      prisma.site.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  static async createSite(orgId: string, userId: string, data: HierarchyInput) {
    const code = normalizeCode(data.code);
    if (code) {
      const dup = await prisma.site.findFirst({
        where: { organization_id: orgId, code, deleted_at: null },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Site code "${code}" already exists in this organization`);
    }
    const site = await prisma.site.create({
      data: {
        organization_id: orgId,
        name: data.name.trim(),
        code,
        location: data.location?.trim() || null,
        timezone: data.timezone || 'UTC',
        is_active: data.is_active ?? true,
        created_by: userId,
      },
    });
    await audit(orgId, userId, 'created', 'Site', site.id, undefined, site);
    return site;
  }

  static async updateSite(id: string, orgId: string, userId: string, data: Partial<HierarchyInput>) {
    const old = await prisma.site.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Site not found');
    const code = data.code !== undefined ? normalizeCode(data.code) : undefined;
    if (code) {
      const dup = await prisma.site.findFirst({
        where: { organization_id: orgId, code, deleted_at: null, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Site code "${code}" already exists in this organization`);
    }
    const updated = await prisma.site.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(data.location !== undefined ? { location: data.location?.trim() || null } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
    });
    await audit(orgId, userId, 'updated', 'Site', id, old, updated);
    return updated;
  }

  static async softDeleteSite(id: string, orgId: string, userId: string) {
    const old = await prisma.site.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!old) throw new HierarchyNotFoundError('Site not found');
    const updated = await prisma.site.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    await audit(orgId, userId, 'archived', 'Site', id, old, updated);
    return updated;
  }

  static async restoreSite(id: string, orgId: string, userId: string) {
    const old = await prisma.site.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Site not found');
    const updated = await prisma.site.update({
      where: { id },
      data: { deleted_at: null, is_active: true },
    });
    await audit(orgId, userId, 'restored', 'Site', id, old, updated);
    return updated;
  }

  // ── Plants ─────────────────────────────────────────────────────────────

  static async listPlants(params: ListParams) {
    const { skip, take, page, pageSize } = paginate(params.page, params.pageSize);
    const where: Prisma.PlantWhereInput = {
      organization_id: params.organizationId,
      ...statusWhere(params.status),
      ...(params.siteId ? { site_id: params.siteId } : {}),
      ...(params.parentId ? { site_id: params.parentId } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.plant.findMany({
        where,
        skip,
        take,
        orderBy: [{ site_id: 'asc' }, { name: 'asc' }],
        include: {
          site: { select: { id: true, name: true, code: true } },
          _count: { select: { units: true, areas: true } },
        },
      }),
      prisma.plant.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  static async createPlant(orgId: string, userId: string, data: HierarchyInput) {
    if (!data.site_id) throw new Error('site_id is required');
    const site = await prisma.site.findFirst({
      where: { id: data.site_id, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!site) throw new HierarchyNotFoundError('Site not found');
    const code = normalizeCode(data.code);
    if (code) {
      const dup = await prisma.plant.findFirst({
        where: { site_id: data.site_id, code, deleted_at: null },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Plant code "${code}" already exists under this site`);
    }
    const plant = await prisma.plant.create({
      data: {
        organization_id: orgId,
        site_id: data.site_id,
        name: data.name.trim(),
        code,
        description: data.description?.trim() || null,
        is_active: data.is_active ?? true,
        created_by: userId,
      },
    });
    await audit(orgId, userId, 'created', 'Plant', plant.id, undefined, plant);
    return plant;
  }

  static async updatePlant(id: string, orgId: string, userId: string, data: Partial<HierarchyInput>) {
    const old = await prisma.plant.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Plant not found');
    const code = data.code !== undefined ? normalizeCode(data.code) : undefined;
    if (code) {
      const dup = await prisma.plant.findFirst({
        where: { site_id: old.site_id, code, deleted_at: null, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Plant code "${code}" already exists under this site`);
    }
    const updated = await prisma.plant.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
    });
    await audit(orgId, userId, 'updated', 'Plant', id, old, updated);
    return updated;
  }

  static async softDeletePlant(id: string, orgId: string, userId: string) {
    const old = await prisma.plant.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!old) throw new HierarchyNotFoundError('Plant not found');
    const updated = await prisma.plant.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    await audit(orgId, userId, 'archived', 'Plant', id, old, updated);
    return updated;
  }

  static async restorePlant(id: string, orgId: string, userId: string) {
    const old = await prisma.plant.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Plant not found');
    const updated = await prisma.plant.update({
      where: { id },
      data: { deleted_at: null, is_active: true },
    });
    await audit(orgId, userId, 'restored', 'Plant', id, old, updated);
    return updated;
  }

  // ── Areas ──────────────────────────────────────────────────────────────

  static async listAreas(params: ListParams) {
    const { skip, take, page, pageSize } = paginate(params.page, params.pageSize);
    const where: Prisma.AreaWhereInput = {
      organization_id: params.organizationId,
      ...statusWhere(params.status),
      ...(params.siteId ? { site_id: params.siteId } : {}),
      ...(params.plantId || params.parentId
        ? { plant_id: params.plantId || params.parentId! }
        : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.area.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          plant: { select: { id: true, name: true, code: true } },
          site: { select: { id: true, name: true, code: true } },
          _count: { select: { units: true } },
        },
      }),
      prisma.area.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  static async createArea(orgId: string, userId: string, data: HierarchyInput) {
    if (!data.plant_id) throw new Error('plant_id is required');
    const plant = await prisma.plant.findFirst({
      where: { id: data.plant_id, organization_id: orgId, deleted_at: null },
      select: { id: true, site_id: true },
    });
    if (!plant) throw new HierarchyNotFoundError('Plant not found');
    const code = normalizeCode(data.code);
    if (code) {
      const dup = await prisma.area.findFirst({
        where: { plant_id: data.plant_id, code, deleted_at: null },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Area code "${code}" already exists under this plant`);
    }
    const area = await prisma.area.create({
      data: {
        organization_id: orgId,
        site_id: plant.site_id,
        plant_id: data.plant_id,
        name: data.name.trim(),
        code,
        description: data.description?.trim() || null,
        is_active: data.is_active ?? true,
        created_by: userId,
      },
    });
    await audit(orgId, userId, 'created', 'Area', area.id, undefined, area);
    return area;
  }

  static async updateArea(id: string, orgId: string, userId: string, data: Partial<HierarchyInput>) {
    const old = await prisma.area.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Area not found');
    const code = data.code !== undefined ? normalizeCode(data.code) : undefined;
    if (code) {
      const dup = await prisma.area.findFirst({
        where: { plant_id: old.plant_id, code, deleted_at: null, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Area code "${code}" already exists under this plant`);
    }
    const updated = await prisma.area.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
    });
    await audit(orgId, userId, 'updated', 'Area', id, old, updated);
    return updated;
  }

  static async softDeleteArea(id: string, orgId: string, userId: string) {
    const old = await prisma.area.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!old) throw new HierarchyNotFoundError('Area not found');
    const updated = await prisma.area.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    await audit(orgId, userId, 'archived', 'Area', id, old, updated);
    return updated;
  }

  static async restoreArea(id: string, orgId: string, userId: string) {
    const old = await prisma.area.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Area not found');
    const updated = await prisma.area.update({
      where: { id },
      data: { deleted_at: null, is_active: true },
    });
    await audit(orgId, userId, 'restored', 'Area', id, old, updated);
    return updated;
  }

  // ── Units ──────────────────────────────────────────────────────────────

  static async listUnits(params: ListParams) {
    const { skip, take, page, pageSize } = paginate(params.page, params.pageSize);
    const where: Prisma.UnitWhereInput = {
      organization_id: params.organizationId,
      ...statusWhere(params.status),
      ...(params.siteId ? { site_id: params.siteId } : {}),
      ...(params.plantId || params.parentId
        ? { plant_id: params.plantId || params.parentId! }
        : {}),
      ...(params.areaId ? { area_id: params.areaId } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          site: { select: { id: true, name: true, code: true } },
          plant: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true, code: true } },
          _count: { select: { systems: true, workpacks: true } },
        },
      }),
      prisma.unit.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  static async createUnit(orgId: string, userId: string, data: HierarchyInput) {
    if (!data.plant_id) throw new Error('plant_id is required');
    const plant = await prisma.plant.findFirst({
      where: { id: data.plant_id, organization_id: orgId, deleted_at: null },
      select: { id: true, site_id: true },
    });
    if (!plant) throw new HierarchyNotFoundError('Plant not found');
    let areaId: string | null = data.area_id ?? null;
    if (areaId) {
      const area = await prisma.area.findFirst({
        where: { id: areaId, plant_id: plant.id, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!area) throw new HierarchyNotFoundError('Area not found under this plant');
    }
    const code = normalizeCode(data.code);
    if (code) {
      const dup = await prisma.unit.findFirst({
        where: { plant_id: data.plant_id, code, deleted_at: null },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Unit code "${code}" already exists under this plant`);
    }
    const unit = await prisma.unit.create({
      data: {
        organization_id: orgId,
        site_id: plant.site_id,
        plant_id: data.plant_id,
        area_id: areaId,
        name: data.name.trim(),
        code,
        description: data.description?.trim() || null,
        is_active: data.is_active ?? true,
        created_by: userId,
      },
    });
    await audit(orgId, userId, 'created', 'Unit', unit.id, undefined, unit);
    return unit;
  }

  static async updateUnit(id: string, orgId: string, userId: string, data: Partial<HierarchyInput>) {
    const old = await prisma.unit.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Unit not found');
    const code = data.code !== undefined ? normalizeCode(data.code) : undefined;
    if (code) {
      const dup = await prisma.unit.findFirst({
        where: { plant_id: old.plant_id, code, deleted_at: null, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Unit code "${code}" already exists under this plant`);
    }
    if (data.area_id) {
      const area = await prisma.area.findFirst({
        where: { id: data.area_id, plant_id: old.plant_id, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!area) throw new HierarchyNotFoundError('Area not found under this plant');
    }
    const updated = await prisma.unit.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        ...(data.area_id !== undefined ? { area_id: data.area_id } : {}),
      },
    });
    await audit(orgId, userId, 'updated', 'Unit', id, old, updated);
    return updated;
  }

  static async softDeleteUnit(id: string, orgId: string, userId: string) {
    const old = await prisma.unit.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!old) throw new HierarchyNotFoundError('Unit not found');
    const updated = await prisma.unit.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    await audit(orgId, userId, 'archived', 'Unit', id, old, updated);
    return updated;
  }

  static async restoreUnit(id: string, orgId: string, userId: string) {
    const old = await prisma.unit.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Unit not found');
    const updated = await prisma.unit.update({
      where: { id },
      data: { deleted_at: null, is_active: true },
    });
    await audit(orgId, userId, 'restored', 'Unit', id, old, updated);
    return updated;
  }

  // ── Systems ────────────────────────────────────────────────────────────

  static async listSystems(params: ListParams) {
    const { skip, take, page, pageSize } = paginate(params.page, params.pageSize);
    const where: Prisma.SystemWhereInput = {
      organization_id: params.organizationId,
      ...statusWhere(params.status),
      ...(params.siteId ? { site_id: params.siteId } : {}),
      ...(params.unitId || params.parentId
        ? { unit_id: params.unitId || params.parentId! }
        : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.system.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          site: { select: { id: true, name: true, code: true } },
          unit: { select: { id: true, name: true, code: true, plant_id: true } },
          _count: { select: { assets: true, workpacks: true } },
        },
      }),
      prisma.system.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  static async createSystem(orgId: string, userId: string, data: HierarchyInput) {
    if (!data.unit_id) throw new Error('unit_id is required');
    const unit = await prisma.unit.findFirst({
      where: { id: data.unit_id, organization_id: orgId, deleted_at: null },
      select: { id: true, site_id: true },
    });
    if (!unit) throw new HierarchyNotFoundError('Unit not found');
    const code = normalizeCode(data.code);
    if (code) {
      const dup = await prisma.system.findFirst({
        where: { unit_id: data.unit_id, code, deleted_at: null },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`System code "${code}" already exists under this unit`);
    }
    const system = await prisma.system.create({
      data: {
        organization_id: orgId,
        site_id: unit.site_id,
        unit_id: data.unit_id,
        name: data.name.trim(),
        code,
        description: data.description?.trim() || null,
        is_active: data.is_active ?? true,
        status: (data.is_active ?? true) ? 'Active' : 'Inactive',
        created_by: userId,
      },
    });
    await audit(orgId, userId, 'created', 'System', system.id, undefined, system);
    return system;
  }

  static async updateSystem(id: string, orgId: string, userId: string, data: Partial<HierarchyInput>) {
    const old = await prisma.system.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('System not found');
    const code = data.code !== undefined ? normalizeCode(data.code) : undefined;
    if (code) {
      const dup = await prisma.system.findFirst({
        where: { unit_id: old.unit_id, code, deleted_at: null, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`System code "${code}" already exists under this unit`);
    }
    const updated = await prisma.system.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.is_active !== undefined
          ? { is_active: data.is_active, status: data.is_active ? 'Active' : 'Inactive' }
          : {}),
      },
    });
    await audit(orgId, userId, 'updated', 'System', id, old, updated);
    return updated;
  }

  static async softDeleteSystem(id: string, orgId: string, userId: string) {
    const old = await prisma.system.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!old) throw new HierarchyNotFoundError('System not found');
    const updated = await prisma.system.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false, status: 'Inactive' },
    });
    await audit(orgId, userId, 'archived', 'System', id, old, updated);
    return updated;
  }

  static async restoreSystem(id: string, orgId: string, userId: string) {
    const old = await prisma.system.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('System not found');
    const updated = await prisma.system.update({
      where: { id },
      data: { deleted_at: null, is_active: true, status: 'Active' },
    });
    await audit(orgId, userId, 'restored', 'System', id, old, updated);
    return updated;
  }

  // ── Assets ─────────────────────────────────────────────────────────────

  static async listAssets(params: ListParams) {
    const { skip, take, page, pageSize } = paginate(params.page, params.pageSize);
    const where: Prisma.AssetWhereInput = {
      organization_id: params.organizationId,
      ...statusWhere(params.status),
      ...(params.siteId ? { site_id: params.siteId } : {}),
      ...(params.plantId ? { plant_id: params.plantId } : {}),
      ...(params.unitId ? { unit_id: params.unitId } : {}),
      ...(params.systemId || params.parentId
        ? { system_id: params.systemId || params.parentId! }
        : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { tag_number: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take,
        orderBy: { tag_number: 'asc' },
        include: {
          Site: { select: { id: true, name: true, code: true } },
          plant: { select: { id: true, name: true, code: true } },
          unit: { select: { id: true, name: true, code: true } },
          system: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.asset.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  static async createAsset(orgId: string, userId: string, data: HierarchyInput) {
    let siteId = data.site_id ?? null;
    let plantId = data.plant_id ?? null;
    let unitId = data.unit_id ?? null;
    let systemId = data.system_id ?? null;

    if (systemId) {
      const system = await prisma.system.findFirst({
        where: { id: systemId, organization_id: orgId, deleted_at: null },
        select: { id: true, unit_id: true, site_id: true, unit: { select: { plant_id: true } } },
      });
      if (!system) throw new HierarchyNotFoundError('System not found');
      siteId = system.site_id;
      unitId = system.unit_id;
      plantId = system.unit.plant_id;
    } else if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organization_id: orgId, deleted_at: null },
        select: { id: true, plant_id: true, site_id: true },
      });
      if (!unit) throw new HierarchyNotFoundError('Unit not found');
      siteId = unit.site_id;
      plantId = unit.plant_id;
    }

    if (!siteId) throw new Error('site_id is required (or provide system_id / unit_id)');
    const site = await prisma.site.findFirst({
      where: { id: siteId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!site) throw new HierarchyNotFoundError('Site not found');

    const tag = (data.tag_number || data.code || '').trim().toUpperCase();
    if (!tag) throw new Error('tag_number (or code) is required');
    const dup = await prisma.asset.findFirst({
      where: { organization_id: orgId, tag_number: tag, deleted_at: null },
      select: { id: true },
    });
    if (dup) throw new HierarchyConflictError(`Asset tag "${tag}" already exists in this organization`);

    const asset = await prisma.asset.create({
      data: {
        organization_id: orgId,
        site_id: siteId,
        plant_id: plantId,
        unit_id: unitId,
        system_id: systemId,
        tag_number: tag,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        asset_type: data.asset_type?.trim() || null,
        is_active: data.is_active ?? true,
        created_by: userId,
      },
    });
    await audit(orgId, userId, 'created', 'Asset', asset.id, undefined, asset);
    return asset;
  }

  static async updateAsset(id: string, orgId: string, userId: string, data: Partial<HierarchyInput>) {
    const old = await prisma.asset.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Asset not found');
    const tag =
      data.tag_number !== undefined || data.code !== undefined
        ? (data.tag_number || data.code || '').trim().toUpperCase()
        : undefined;
    if (tag) {
      const dup = await prisma.asset.findFirst({
        where: { organization_id: orgId, tag_number: tag, deleted_at: null, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new HierarchyConflictError(`Asset tag "${tag}" already exists in this organization`);
    }
    const updated = await prisma.asset.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(tag !== undefined ? { tag_number: tag } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.asset_type !== undefined ? { asset_type: data.asset_type?.trim() || null } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        ...(data.system_id !== undefined ? { system_id: data.system_id } : {}),
        ...(data.unit_id !== undefined ? { unit_id: data.unit_id } : {}),
        ...(data.plant_id !== undefined ? { plant_id: data.plant_id } : {}),
      },
    });
    await audit(orgId, userId, 'updated', 'Asset', id, old, updated);
    return updated;
  }

  static async softDeleteAsset(id: string, orgId: string, userId: string) {
    const old = await prisma.asset.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!old) throw new HierarchyNotFoundError('Asset not found');
    const updated = await prisma.asset.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    await audit(orgId, userId, 'archived', 'Asset', id, old, updated);
    return updated;
  }

  static async restoreAsset(id: string, orgId: string, userId: string) {
    const old = await prisma.asset.findFirst({ where: { id, organization_id: orgId } });
    if (!old) throw new HierarchyNotFoundError('Asset not found');
    const updated = await prisma.asset.update({
      where: { id },
      data: { deleted_at: null, is_active: true },
    });
    await audit(orgId, userId, 'restored', 'Asset', id, old, updated);
    return updated;
  }
}
