import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { PrimaveraXmlFormatter, type P6Activity, type P6Relationship } from '@/modules/Scheduling/formatters/PrimaveraXmlFormatter';
import { isMilestoneActivity } from '@/core/activity/milestoneDerivation';

/**
 * GET /api/workpacks/[id]/export/primavera
 *
 * Exports a workpack's activities as a Primavera P6 XER-lite file.
 * The XER format is tab-delimited and directly importable by P6.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const orgId = await getOrgIdFromRequest(req);
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: workpackId } = await context.params;

  // Fetch workpack with activities and relationships
  const workpack = await prisma.workpack.findFirst({
    where: { id: workpackId, organization_id: orgId, deleted_at: null },
    include: {
      activities: {
        where: { deleted_at: null },
        include: {
          successors: true,
        },
        orderBy: { sequence_number: 'asc' },
      },
      project: {
        // OD9.2 §11/§15: Project fields are snake_case, and Project has `name`, not
        // `title`. The previous camelCase/`title` select made this P6 export throw.
        select: { id: true, name: true, planned_sd_date: true, planned_su_date: true },
      },
    },
  });

  if (!workpack) {
    return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });
  }

  // Map to P6 types
  const p6Activities: P6Activity[] = workpack.activities.map(a => ({
    id:               a.id,
    activity_code:    a.activity_number ?? a.activity_id ?? null,
    description:      a.description,
    planned_start:    a.planned_start,
    planned_end:      a.planned_end,
    duration_hours:   Number(a.duration_hours ?? 0),
    percent_complete: a.progress_percent ?? 0,
    wbs_code:         a.wbs_code ?? null,
    // OD9.1: was hardcoded false, so every milestone exported to P6 as a normal
    // activity. Derived from the EVM work-category/zero-duration rule instead; there is
    // no Activity.is_milestone column to read.
    is_milestone:     isMilestoneActivity(a),
  }));

  // Build activity_code lookup for relationships
  const idToCode = new Map(
    workpack.activities.map(a => [a.id, a.activity_number ?? a.activity_id ?? a.id])
  );

  const p6Relationships: P6Relationship[] = workpack.activities.flatMap(a =>
    a.successors.map(rel => ({
      predecessor_activity_code: idToCode.get(a.id) ?? a.id,
      successor_activity_code:   idToCode.get(rel.successor_id) ?? rel.successor_id,
      relationship_type:         (rel.relationship_type as 'FS' | 'SS' | 'FF' | 'SF') ?? 'FS',
      // Sprint 1a — canonical lag_minutes → 8h-day units; legacy lag_days fallback.
      lag_days:                  rel.lag_minutes != null ? Number(rel.lag_minutes) / 480 : Number(rel.lag_days ?? 0),
    }))
  );

  const p6Project = {
    id:          workpack.project?.id ?? workpackId,
    name:        workpack.title,
    start_date:  workpack.project?.planned_sd_date ?? null,
    finish_date: workpack.project?.planned_su_date ?? null,
  };

  const xerContent = PrimaveraXmlFormatter.format(p6Project, p6Activities, p6Relationships);

  const filename = `${workpack.title.replace(/[^a-z0-9]/gi, '_')}_p6.xer`;

  return new NextResponse(xerContent, {
    status: 200,
    headers: {
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
