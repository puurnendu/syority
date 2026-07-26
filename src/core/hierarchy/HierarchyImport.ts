/**
 * Hierarchy Excel/CSV import with validation report.
 * Columns: Code, Name, Description, Parent, Status
 * Entity type is selected by the caller (plant | area | unit | system | asset).
 */
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import {
  HierarchyConflictError,
  HierarchyService,
  type HierarchyEntity,
} from './HierarchyService';

export type ImportRow = {
  row: number;
  code: string;
  name: string;
  description: string;
  parent: string;
  status: string;
};

export type ImportIssue = {
  row: number;
  severity: 'error' | 'warning';
  message: string;
};

export type ImportValidationReport = {
  entity: HierarchyEntity;
  totalRows: number;
  validRows: number;
  issues: ImportIssue[];
  preview: ImportRow[];
};

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    code: 'code',
    name: 'name',
    description: 'description',
    desc: 'description',
    parent: 'parent',
    parent_code: 'parent',
    status: 'status',
    tag: 'code',
    tag_number: 'code',
  };
  return map[key] ?? '';
}

function parseStatus(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return true;
  if (['inactive', 'archived', 'false', '0', 'no'].includes(s)) return false;
  return true;
}

export async function parseHierarchyFile(buffer: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } else {
    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    const sheet = workbook.addWorksheet('import');
    lines.forEach((line, i) => {
      const cells: string[] = [];
      let cur = '';
      let inQ = false;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"') {
          inQ = !inQ;
          continue;
        }
        if (ch === ',' && !inQ) {
          cells.push(cur);
          cur = '';
          continue;
        }
        cur += ch;
      }
      cells.push(cur);
      sheet.getRow(i + 1).values = [undefined, ...cells];
    });
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('File has no worksheets');

  const headerRow = worksheet.getRow(1);
  const columnMap: Record<number, string> = {};
  headerRow.eachCell((cell, colIdx) => {
    const mapped = normalizeHeader(String(cell.value ?? ''));
    if (mapped) columnMap[colIdx] = mapped;
  });

  if (!Object.values(columnMap).includes('code') || !Object.values(columnMap).includes('name')) {
    throw new Error('Required columns: Code, Name (optional: Description, Parent, Status)');
  }

  const rows: ImportRow[] = [];
  worksheet.eachRow((row, rowIdx) => {
    if (rowIdx === 1) return;
    if (row.actualCellCount === 0) return;
    const data: Record<string, string> = {};
    row.eachCell((cell, colIdx) => {
      const field = columnMap[colIdx];
      if (!field) return;
      data[field] =
        typeof cell.value === 'string'
          ? cell.value.trim()
          : String(cell.value ?? '').trim();
    });
    if (!data.code && !data.name) return;
    rows.push({
      row: rowIdx,
      code: data.code || '',
      name: data.name || '',
      description: data.description || '',
      parent: data.parent || '',
      status: data.status || 'Active',
    });
  });
  return rows;
}

export async function validateHierarchyImport(
  orgId: string,
  entity: HierarchyEntity,
  rows: ImportRow[]
): Promise<ImportValidationReport> {
  const issues: ImportIssue[] = [];
  let validRows = 0;

  // Load parent lookup caches
  const sites = await prisma.site.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true },
  });
  const plants = await prisma.plant.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, site_id: true },
  });
  const areas = await prisma.area.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, plant_id: true },
  });
  const units = await prisma.unit.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, plant_id: true },
  });
  const systems = await prisma.system.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, unit_id: true },
  });

  const findByCodeOrName = <T extends { code: string | null; name: string }>(
    list: T[],
    key: string
  ) =>
    list.find(
      (x) =>
        (x.code && x.code.toLowerCase() === key.toLowerCase()) ||
        x.name.toLowerCase() === key.toLowerCase()
    );

  const seenInFile = new Map<string, number>();

  for (const r of rows) {
    if (!r.code.trim()) {
      issues.push({ row: r.row, severity: 'error', message: 'Code is required' });
      continue;
    }
    if (!r.name.trim()) {
      issues.push({ row: r.row, severity: 'error', message: 'Name is required' });
      continue;
    }
    if (!r.parent.trim() && entity !== 'site') {
      issues.push({ row: r.row, severity: 'error', message: 'Parent is required' });
      continue;
    }

    const parentKey = r.parent.trim();
    let parentOk = true;
    if (entity === 'plant') {
      parentOk = !!findByCodeOrName(sites, parentKey);
      if (!parentOk) issues.push({ row: r.row, severity: 'error', message: `Site not found: ${parentKey}` });
    } else if (entity === 'area') {
      parentOk = !!findByCodeOrName(plants, parentKey);
      if (!parentOk) issues.push({ row: r.row, severity: 'error', message: `Plant not found: ${parentKey}` });
    } else if (entity === 'unit') {
      // Parent may be Plant or Area
      parentOk = !!findByCodeOrName(plants, parentKey) || !!findByCodeOrName(areas, parentKey);
      if (!parentOk)
        issues.push({ row: r.row, severity: 'error', message: `Plant/Area not found: ${parentKey}` });
    } else if (entity === 'system') {
      parentOk = !!findByCodeOrName(units, parentKey);
      if (!parentOk) issues.push({ row: r.row, severity: 'error', message: `Unit not found: ${parentKey}` });
    } else if (entity === 'asset') {
      parentOk =
        !!findByCodeOrName(systems, parentKey) ||
        !!findByCodeOrName(units, parentKey) ||
        !!findByCodeOrName(sites, parentKey);
      if (!parentOk)
        issues.push({
          row: r.row,
          severity: 'error',
          message: `Parent (System/Unit/Site) not found: ${parentKey}`,
        });
    }

    const fileDupKey = `${parentKey.toLowerCase()}::${r.code.trim().toLowerCase()}`;
    if (seenInFile.has(fileDupKey)) {
      issues.push({
        row: r.row,
        severity: 'error',
        message: `Duplicate code "${r.code}" in file (also row ${seenInFile.get(fileDupKey)})`,
      });
      parentOk = false;
    } else {
      seenInFile.set(fileDupKey, r.row);
    }

    if (parentOk) validRows++;
  }

  return {
    entity,
    totalRows: rows.length,
    validRows,
    issues,
    preview: rows.slice(0, 50),
  };
}

export async function commitHierarchyImport(
  orgId: string,
  userId: string,
  entity: HierarchyEntity,
  rows: ImportRow[]
): Promise<{ created: number; skipped: number; errors: ImportIssue[] }> {
  const report = await validateHierarchyImport(orgId, entity, rows);
  if (report.issues.some((i) => i.severity === 'error')) {
    return { created: 0, skipped: rows.length, errors: report.issues };
  }

  const sites = await prisma.site.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true },
  });
  const plants = await prisma.plant.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, site_id: true },
  });
  const areas = await prisma.area.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, plant_id: true },
  });
  const units = await prisma.unit.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, plant_id: true, site_id: true },
  });
  const systems = await prisma.system.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, unit_id: true, site_id: true },
  });

  const find = <T extends { code: string | null; name: string }>(list: T[], key: string) =>
    list.find(
      (x) =>
        (x.code && x.code.toLowerCase() === key.toLowerCase()) ||
        x.name.toLowerCase() === key.toLowerCase()
    );

  let created = 0;
  let skipped = 0;
  const errors: ImportIssue[] = [];

  for (const r of rows) {
    try {
      const active = parseStatus(r.status);
      const parentKey = r.parent.trim();
      if (entity === 'plant') {
        const site = find(sites, parentKey)!;
        await HierarchyService.createPlant(orgId, userId, {
          site_id: site.id,
          code: r.code,
          name: r.name,
          description: r.description,
          is_active: active,
        });
      } else if (entity === 'area') {
        const plant = find(plants, parentKey)!;
        await HierarchyService.createArea(orgId, userId, {
          plant_id: plant.id,
          code: r.code,
          name: r.name,
          description: r.description,
          is_active: active,
        });
      } else if (entity === 'unit') {
        const area = find(areas, parentKey);
        const plant = area
          ? plants.find((p) => p.id === area.plant_id)!
          : find(plants, parentKey)!;
        await HierarchyService.createUnit(orgId, userId, {
          plant_id: plant.id,
          area_id: area?.id ?? null,
          code: r.code,
          name: r.name,
          description: r.description,
          is_active: active,
        });
      } else if (entity === 'system') {
        const unit = find(units, parentKey)!;
        await HierarchyService.createSystem(orgId, userId, {
          unit_id: unit.id,
          code: r.code,
          name: r.name,
          description: r.description,
          is_active: active,
        });
      } else if (entity === 'asset') {
        const system = find(systems, parentKey);
        const unit = !system ? find(units, parentKey) : undefined;
        const site =
          system
            ? sites.find((s) => s.id === system.site_id)!
            : unit
              ? sites.find((s) => s.id === unit.site_id)!
              : find(sites, parentKey)!;
        await HierarchyService.createAsset(orgId, userId, {
          site_id: site.id,
          system_id: system?.id ?? null,
          unit_id: system ? undefined : unit?.id,
          code: r.code,
          tag_number: r.code,
          name: r.name,
          description: r.description,
          is_active: active,
        });
      } else if (entity === 'site') {
        await HierarchyService.createSite(orgId, userId, {
          code: r.code,
          name: r.name,
          description: r.description,
          is_active: active,
        });
      }
      created++;
    } catch (e) {
      skipped++;
      errors.push({
        row: r.row,
        severity: 'error',
        message: e instanceof HierarchyConflictError || e instanceof Error ? e.message : 'Failed',
      });
    }
  }

  return { created, skipped, errors };
}
