/**
 * M7.6C — Widget Marketplace API
 * GET — List available widget definitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('ois:widget.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const url = new URL(req.url);
  const category = url.searchParams.get('category') ?? undefined;

  const widgets = await DashboardService.listWidgetDefinitions({
    category,
    organizationId: orgId,
  });

  return NextResponse.json({ data: widgets });
}
