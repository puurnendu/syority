import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[eventId]/materials
 *
 * Aggregates all WorkpackMaterialLine records across all workpacks in the event.
 * Groups by item_catalog_id (or description for uncatalogued items).
 * Flags shortages where quantity_required > quantity_issued.
 *
 * Query params:
 *   - category: filter by material_category (mechanical, electrical, …)
 *   - shortage_only: 'true' → only return items with a shortage
 *
 * Response:
 *   {
 *     summary: { total_items, shortage_items, total_value, categories },
 *     items: MaterialAggregateRow[],
 *   }
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ eventId: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { eventId } = await context.params;

    const url = new URL(req.url, 'http://localhost');
    const categoryFilter = url.searchParams.get('category');
    const shortageOnly = url.searchParams.get('shortage_only') === 'true';

    // Verify event belongs to this org
    const event = await prisma.event.findFirst({
        where: { id: eventId, organization_id: orgId },
        select: { id: true, name: true },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // Get all workpacks in this event
    const workpacks = await prisma.workpack.findMany({
        where: { event_id: eventId, organization_id: orgId, deleted_at: null },
        select: { id: true, workpack_number: true, workpack_id_code: true, title: true, status: true },
    });

    if (workpacks.length === 0) {
        return NextResponse.json({
            event: { id: event.id, name: event.name },
            summary: { total_items: 0, shortage_items: 0, total_value: 0, categories: [], workpack_count: 0 },
            items: [],
        });
    }

    const workpackIds = workpacks.map((wp) => wp.id);
    const workpackMap = new Map(workpacks.map((wp) => [wp.id, wp]));

    // Fetch all material lines
    const lines = await prisma.workpackMaterialLine.findMany({
        where: {
            workpack_id: { in: workpackIds },
            deleted_at: null,
            ...(categoryFilter ? { material_category: categoryFilter } : {}),
        },
        orderBy: [{ material_category: 'asc' }, { description: 'asc' }],
    });

    // Aggregate by item_catalog_id || description key
    type AggRow = {
        key: string;
        item_catalog_id: string | null;
        item_code: string | null;
        sap_material_number: string | null;
        description: string;
        unit_of_measure: string;
        material_category: string;
        total_required: number;
        total_issued: number;
        shortage: number;
        is_shortage: boolean;
        unit_cost: number | null;
        total_value: number | null;
        workpacks: Array<{
            id: string;
            workpack_number: string | null;
            title: string;
            required: number;
            issued: number;
        }>;
    };

    const agg: Record<string, AggRow> = {};

    for (const line of lines) {
        const key = line.item_catalog_id ?? line.description.toLowerCase().trim();
        const wp = workpackMap.get(line.workpack_id);

        if (!agg[key]) {
            agg[key] = {
                key,
                item_catalog_id: line.item_catalog_id,
                item_code: line.item_code,
                sap_material_number: line.sap_material_number,
                description: line.description,
                unit_of_measure: line.unit_of_measure,
                material_category: line.material_category ?? 'mechanical',
                total_required: 0,
                total_issued: 0,
                shortage: 0,
                is_shortage: false,
                unit_cost: line.unit_cost ?? null,
                total_value: null,
                workpacks: [],
            };
        }

        const row = agg[key];
        const req_qty = line.quantity_required;
        const issued_qty = line.quantity_issued;

        row.total_required += req_qty;
        row.total_issued += issued_qty;

        if (wp) {
            const existingWp = row.workpacks.find((w) => w.id === wp.id);
            if (existingWp) {
                existingWp.required += req_qty;
                existingWp.issued += issued_qty;
            } else {
                row.workpacks.push({
                    id: wp.id,
                    workpack_number: wp.workpack_number ?? wp.workpack_id_code,
                    title: wp.title,
                    required: req_qty,
                    issued: issued_qty,
                });
            }
        }
    }

    // Compute derived fields and total value
    let totalValue = 0;
    let shortageCount = 0;
    const categories = new Set<string>();

    for (const row of Object.values(agg)) {
        row.shortage = Math.max(0, row.total_required - row.total_issued);
        row.is_shortage = row.shortage > 0;
        if (row.is_shortage) shortageCount++;
        categories.add(row.material_category);
        if (row.unit_cost != null) {
            row.total_value = row.unit_cost * row.total_required;
            totalValue += row.total_value;
        }
    }

    let items = Object.values(agg);
    if (shortageOnly) items = items.filter((r) => r.is_shortage);

    // Sort: shortages first, then by category, then description
    items.sort((a, b) => {
        if (b.is_shortage !== a.is_shortage) return b.is_shortage ? 1 : -1;
        if (a.material_category !== b.material_category) return a.material_category.localeCompare(b.material_category);
        return a.description.localeCompare(b.description);
    });

    return NextResponse.json({
        event: { id: event.id, name: event.name },
        summary: {
            total_items: items.length,
            shortage_items: shortageCount,
            total_value: Math.round(totalValue * 100) / 100,
            categories: [...categories].sort(),
            workpack_count: workpacks.length,
        },
        items,
    });
}
