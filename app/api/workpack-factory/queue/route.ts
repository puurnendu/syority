import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackFactoryService } from '@/core/workpack-factory';

/**
 * M9 — Factory Queue API.
 *
 * GET /api/workpack-factory/queue
 *
 * Returns scope items from approved/frozen scopes with template recommendations,
 * filtered by event, scope, discipline, priority, equipment type, etc.
 *
 * Also returns template recommendations for pending items (batched).
 */
export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const sp = req.nextUrl.searchParams;

  try {
    // ── Get queue items ──────────────────────────────────────────────────
    const queue = await WorkpackFactoryService.getQueue(orgId, {
      eventId: sp.get('event_id') || undefined,
      scopeId: sp.get('scope_id') || undefined,
      discipline: sp.get('discipline') || undefined,
      priority: sp.get('priority') || undefined,
      equipmentType: sp.get('equipment_type') || undefined,
      unitId: sp.get('unit_id') || undefined,
      systemId: sp.get('system_id') || undefined,
      status: (sp.get('status') as any) || undefined,
      search: sp.get('search') || undefined,
      page: sp.get('page') ? Number(sp.get('page')) : undefined,
      pageSize: sp.get('page_size') ? Number(sp.get('page_size')) : undefined,
    });

    // ── Get template recommendations for pending items ───────────────────
    const pendingItems = queue.items.filter((i) => i.factory_status === 'pending');
    const pendingIds = pendingItems.map((i) => i.id);

    let recommendations: Awaited<
      ReturnType<typeof WorkpackFactoryService.getTemplateRecommendations>
    > = [];

    if (pendingIds.length > 0 && pendingIds.length <= 50) {
      // Batch-fetch recommendations for up to 50 pending items
      recommendations =
        await WorkpackFactoryService.getTemplateRecommendations(orgId, pendingIds);
    }

    // ── Merge recommendations into items ─────────────────────────────────
    const recMap = new Map(recommendations.map((r) => [r.scopeItemId, r]));
    const enrichedItems = queue.items.map((item) => {
      const rec = recMap.get(item.id);
      return {
        ...item,
        template_recommendations: rec?.recommendations || [],
      };
    });

    // ── Get KPIs ─────────────────────────────────────────────────────────
    const kpis = await WorkpackFactoryService.getKpis(
      orgId,
      sp.get('event_id') || undefined
    );

    return NextResponse.json({
      data: {
        items: enrichedItems,
        totals: queue.totals,
        scopes: queue.scopes,
        kpis,
        page: queue.page,
        pageSize: queue.pageSize,
        totalCount: queue.totalCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
