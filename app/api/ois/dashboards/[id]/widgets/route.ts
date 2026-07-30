/**
 * M7.6C — OIS Dashboard Widget Management API
 *
 * GET  — List widgets on a dashboard
 * POST — Add a widget to a dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.view');
  if (error) return error;

  const { id } = await params;
  const dashboard = await DashboardService.getById(id, true);

  return NextResponse.json({ data: dashboard.widgets });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  if (!body.widgetDefinitionId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'widgetDefinitionId is required' } },
      { status: 400 },
    );
  }

  const widget = await DashboardService.addWidget(id, {
    widgetDefinitionId: body.widgetDefinitionId,
    pageId: body.pageId,
    gridX: body.gridX,
    gridY: body.gridY,
    gridW: body.gridW,
    gridH: body.gridH,
    titleOverride: body.titleOverride,
    subtitle: body.subtitle,
    providerParams: body.providerParams,
    visualizationConfig: body.visualizationConfig,
    thresholdConfig: body.thresholdConfig,
  });

  return NextResponse.json({ data: widget }, { status: 201 });
}
