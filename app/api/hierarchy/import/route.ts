import { NextRequest, NextResponse } from 'next/server';
import { guardTenantApi } from '@/security/apiGuards';
import { orgScope } from '@/lib/apiGuard';
import type { Permission } from '@/lib/permissions';
import type { HierarchyEntity } from '@/core/hierarchy/HierarchyService';
import {
  commitHierarchyImport,
  parseHierarchyFile,
  validateHierarchyImport,
} from '@/core/hierarchy/HierarchyImport';

const MANAGE_PERM: Record<HierarchyEntity, Permission> = {
  site: 'site.manage',
  plant: 'plant.manage',
  area: 'area.manage',
  unit: 'unit.manage',
  system: 'system.manage',
  asset: 'asset.manage',
};

const ENTITIES = new Set<HierarchyEntity>(['site', 'plant', 'area', 'unit', 'system', 'asset']);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const entityRaw = String(formData.get('entity') || '').toLowerCase() as HierarchyEntity;
    if (!ENTITIES.has(entityRaw)) {
      return NextResponse.json(
        { error: 'entity must be one of: site, plant, area, unit, system, asset' },
        { status: 400 }
      );
    }

    const { session, error } = await guardTenantApi(MANAGE_PERM[entityRaw]);
    if (error) return error;
    const { orgId, userId } = orgScope(session!);

    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const dryRun = String(formData.get('dryRun') ?? 'true') !== 'false';
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseHierarchyFile(buffer);

    if (dryRun) {
      const report = await validateHierarchyImport(orgId, entityRaw, rows);
      return NextResponse.json({ dryRun: true, report });
    }

    const result = await commitHierarchyImport(orgId, userId, entityRaw, rows);
    return NextResponse.json({ dryRun: false, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
