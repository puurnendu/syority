/**
 * M7.6C — Cache Invalidation API
 * POST — Manually invalidate OIS widget data cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WidgetDataService } from '@/core/ois';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('ois:dashboard.admin');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const body = await req.json().catch(() => ({}));

  if (body.providerKey) {
    await WidgetDataService.invalidateCache(body.providerKey, orgId);
  } else {
    await WidgetDataService.invalidateOrgCache(orgId);
  }

  return NextResponse.json({ data: { invalidated: true, providerKey: body.providerKey ?? 'all' } });
}
