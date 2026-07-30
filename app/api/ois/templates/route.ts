/**
 * M7.6C — Dashboard Templates API
 * GET — List available dashboard templates (system + org)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('ois:dashboard.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const result = await DashboardService.list(orgId, {
    includeTemplates: true,
    page: 1,
    pageSize: 100,
  });

  const templates = result.dashboards.filter(
    (d) => d.is_template || d.is_system
  );

  return NextResponse.json({ data: templates });
}
