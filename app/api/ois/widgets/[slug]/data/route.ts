/**
 * M7.6C — Widget Data API
 * GET — Fetch data for a specific widget via its provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WidgetDataService } from '@/core/ois';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { session, error } = await guardApi('ois:widget.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { slug } = await params;
  const url = new URL(req.url);

  // Build params from query string
  const providerParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k !== 'skipCache') providerParams[k] = v;
  });

  const skipCache = url.searchParams.get('skipCache') === 'true';

  // Look up widget definition to get provider key
  const { DashboardService } = await import('@/core/ois');
  const widgetDef = await DashboardService.getWidgetDefinition(slug);

  const data = await WidgetDataService.fetchWidgetData({
    providerKey: widgetDef.provider_key,
    params: providerParams,
    organizationId: orgId,
    skipCache,
  });

  return NextResponse.json({
    data,
    meta: {
      widgetSlug: slug,
      providerKey: widgetDef.provider_key,
      fetchedAt: new Date().toISOString(),
    },
  });
}
