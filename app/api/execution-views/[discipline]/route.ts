/**
 * GET /api/execution-views/[discipline] — Execution View (Operational Workspace)
 *
 * EXECUTION VIEW RULES (R2.1):
 * 1. Execution Views are derived OPERATIONAL WORKSPACES.
 * 2. Reads: Aggregate data across Workpacks by discipline.
 * 3. Writes: Through existing entity-specific APIs (Activity, Blind, etc.)
 * 4. NEVER modifies Asset Master Data.
 * 5. NEVER creates multi-equipment Workpacks.
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §12 (R2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ discipline: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { discipline } = await params;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || undefined;
    const siteId = searchParams.get('site_id') || undefined;

    // 1. Find discipline
    const disciplineRecord = await prisma.discipline.findFirst({
      where: {
        organization_id: orgId,
        OR: [
          { code: discipline },
          { name: { contains: discipline, mode: 'insensitive' } },
        ],
      },
    });

    if (!disciplineRecord) {
      return NextResponse.json({ error: `Discipline not found: ${discipline}` }, { status: 404 });
    }

    // 2. Find workpacks for this discipline
    const workpackFilter: any = {
      organization_id: orgId,
      discipline_id: disciplineRecord.id,
      deleted_at: null,
    };
    if (status) workpackFilter.status = status;
    if (siteId) workpackFilter.site_id = siteId;

    const workpacks = await prisma.workpack.findMany({
      where: workpackFilter,
      include: {
        asset: { select: { id: true, tag_number: true, name: true, asset_type: true } },
        activities: {
          where: { deleted_at: null },
          select: {
            id: true,
            activity_number: true,
            description: true,
            status: true,
            progress_percent: true,
            planned_start: true,
            planned_end: true,
          },
        },
        blinds: {
          select: {
            id: true,
            blind_number: true,
            location: true,
            status: true,
            flange_size: true,
          },
        },
      },
    });

    // 3. Flatten into execution view rows
    const activitiesView = workpacks.flatMap((wp: any) =>
      (wp.activities || []).map((act: any) => ({
        workpack_id: wp.id,
        workpack_number: wp.workpack_number,
        workpack_title: wp.title,
        workpack_status: wp.status,
        asset_tag: wp.asset?.tag_number ?? null,
        asset_name: wp.asset?.name ?? null,
        activity_id: act.id,
        activity_number: act.activity_number,
        activity_description: act.description,
        activity_status: act.status,
        progress_percent: act.progress_percent,
        planned_start: act.planned_start,
        planned_end: act.planned_end,
      }))
    );

    const blindsView = workpacks.flatMap((wp: any) =>
      (wp.blinds || []).map((blind: any) => ({
        workpack_id: wp.id,
        workpack_number: wp.workpack_number,
        workpack_title: wp.title,
        workpack_status: wp.status,
        asset_tag: wp.asset?.tag_number ?? null,
        asset_name: wp.asset?.name ?? null,
        blind_id: blind.id,
        blind_number: blind.blind_number,
        location: blind.location,
        blind_status: blind.status,
        flange_size: blind.flange_size,
      }))
    );

    return NextResponse.json({
      discipline: { id: disciplineRecord.id, code: disciplineRecord.code, name: disciplineRecord.name },
      workpack_count: workpacks.length,
      activities: activitiesView,
      blinds: blindsView,
    });
  } catch (error: any) {
    console.error('[GET /api/execution-views/[discipline]]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch execution view' },
      { status: 500 }
    );
  }
}
