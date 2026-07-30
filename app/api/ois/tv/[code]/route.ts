/**
 * M7.6C — TV Session Detail API
 * GET    — Get TV session by code (for display)
 * DELETE — End a TV session
 */

import { NextRequest, NextResponse } from 'next/server';
import { TVModeService } from '@/core/ois';
import { WidgetDataService } from '@/core/ois';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  // TV sessions are public access (via session code) — no auth guard
  const { code } = await params;
  const session = await TVModeService.getByCode(code);

  if (!session) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'TV session not found or expired' } },
      { status: 404 },
    );
  }

  // Fetch data for all visible widgets
  const widgetFetchList = session.dashboard.widgets.map((w: any) => ({
    id: w.id,
    providerKey: w.widget_definition.provider_key,
    params: (w.provider_params as Record<string, any>) ?? {},
  }));
  const dataMap = await WidgetDataService.batchFetch({
    widgets: widgetFetchList,
    organizationId: session.organization_id,
  });

  // Convert dataMap to serializable object
  const widgetData: Record<string, any> = {};
  dataMap.forEach((v, k) => { widgetData[k] = v; });

  return NextResponse.json({
    data: {
      sessionCode: session.session_code,
      rotationIntervalSec: session.rotation_interval_sec,
      autoRefreshSec: session.auto_refresh_sec,
      expiresAt: session.expires_at,
      dashboard: {
        name: session.dashboard.name,
        theme: session.dashboard.theme,
        pages: session.dashboard.pages,
        widgets: session.dashboard.widgets,
      },
      widgetData,
    },
  });
}
