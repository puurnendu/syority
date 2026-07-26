import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

function isoWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoWeekEnd(date: Date): Date {
  const start = isoWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function weekLabel(weekStart: Date): string {
  const year = weekStart.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const weekNo = Math.ceil(((weekStart.getTime() - isoWeekStart(jan4).getTime()) / 86_400_000 + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { plannedSdDate: true, plannedSuDate: true },
    });

    if (!project?.plannedSdDate || !project?.plannedSuDate) {
      return NextResponse.json({ error: 'Project missing planned dates' }, { status: 422 });
    }

    const activities = await prisma.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
        deleted_at: null,
      },
      select: {
        planned_start: true,
        planned_end: true,
        duration_hours: true,
        discipline: { select: { code: true, name: true } },
      },
    });

    // Determine project date range
    const projectStart = new Date(project.plannedSdDate);
    const projectFinish = new Date(project.plannedSuDate);

    // Initialize buckets
    const bucketsMap = new Map<string, Record<string, number>>();
    const cursor = isoWeekStart(projectStart);
    const finish = isoWeekStart(projectFinish);
    finish.setDate(finish.getDate() + 6);

    while (cursor <= finish) {
      const label = weekLabel(cursor);
      bucketsMap.set(label, { week: label as any }); // week property is special
      cursor.setDate(cursor.getDate() + 7);
    }

    const disciplines = new Set<string>();

    // Spread hours
    for (const act of activities) {
      if (!act.planned_start || !act.planned_end || !act.duration_hours) continue;

      const start = new Date(act.planned_start);
      const end = new Date(act.planned_end);
      if (end < start) continue;

      const durationMs = end.getTime() - start.getTime() || 1; // avoid divide by 0
      const disc = act.discipline?.name || act.discipline?.code || 'Unassigned';
      disciplines.add(disc);

      // Distribute hours across weeks
      let tempStart = new Date(start);
      while (tempStart <= end) {
        const weekStart = isoWeekStart(tempStart);
        const weekLabelStr = weekLabel(weekStart);
        
        const weekEnd = isoWeekEnd(tempStart);
        const overlapEnd = new Date(Math.min(end.getTime(), weekEnd.getTime()));
        const overlapMs = overlapEnd.getTime() - tempStart.getTime() + 1;
        
        const fraction = overlapMs / durationMs;
        const allocatedHours = Number(act.duration_hours) * fraction;

        const bucket = bucketsMap.get(weekLabelStr);
        if (bucket) {
          bucket[disc] = (bucket[disc] || 0) + allocatedHours;
        }

        // Move to start of next week
        tempStart = new Date(weekEnd.getTime() + 1);
      }
    }

    const data = Array.from(bucketsMap.values()).map(bucket => {
      // Round to 1 decimal
      for (const key of Object.keys(bucket)) {
        if (key !== 'week') bucket[key] = Math.round((bucket[key] as number) * 10) / 10;
      }
      return bucket;
    });

    return NextResponse.json({
      histogram: data,
      disciplines: Array.from(disciplines).sort(),
    });

  } catch (err: any) {
    console.error('[ResourceHistogram] Error:', err);
    return NextResponse.json({ error: 'Failed to generate histogram' }, { status: 500 });
  }
});
