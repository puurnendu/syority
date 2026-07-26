import { NextRequest, NextResponse } from 'next/server';
import { guardTenantApi } from '@/security/apiGuards';
import { orgScope } from '@/lib/apiGuard';
import type { Permission } from '@/lib/permissions';
import {
  HierarchyConflictError,
  HierarchyNotFoundError,
  type ListParams,
} from '@/core/hierarchy/HierarchyService';

export function parseListParams(req: NextRequest, orgId: string): ListParams {
  const sp = req.nextUrl.searchParams;
  return {
    organizationId: orgId,
    page: Number(sp.get('page') || 1) || 1,
    pageSize: Number(sp.get('pageSize') || 25) || 25,
    search: sp.get('search') || undefined,
    status: (sp.get('status') as ListParams['status']) || 'active',
    parentId: sp.get('parentId') || undefined,
    siteId: sp.get('siteId') || undefined,
    plantId: sp.get('plantId') || undefined,
    areaId: sp.get('areaId') || undefined,
    unitId: sp.get('unitId') || undefined,
    systemId: sp.get('systemId') || undefined,
  };
}

export async function withHierarchyGuard(permission: Permission) {
  const { session, error } = await guardTenantApi(permission);
  if (error) return { session: null, error, orgId: '', userId: '' };
  const { orgId, userId } = orgScope(session!);
  return { session, error: null, orgId, userId };
}

export function hierarchyErrorResponse(err: unknown) {
  if (err instanceof HierarchyConflictError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof HierarchyNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  if (
    message.includes('required') ||
    message.includes('is required') ||
    message.includes('not found under')
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error('[hierarchy]', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
