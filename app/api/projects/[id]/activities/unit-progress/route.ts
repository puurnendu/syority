import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const workpacks = await prisma.workpack.findMany({
    where: {
      project_id: projectId,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      unit: { select: { name: true, code: true } },
      activities: {
        select: {
          progress_percent: true,
          planned_start: true,
          planned_end: true,
        },
      },
    },
  });

  const byUnit: Record<string, { planned: number[]; actual: number[] }> = {};

  for (const wp of workpacks) {
    const unitName = wp.unit?.code ?? wp.unit?.name ?? 'Other';
    if (!byUnit[unitName]) byUnit[unitName] = { planned: [], actual: [] };

    const now = new Date();
    for (const act of wp.activities) {
      let plannedPct = 0;
      if (act.planned_start && act.planned_end) {
        const total =
          new Date(act.planned_end).getTime() - new Date(act.planned_start).getTime();
        const elapsed = now.getTime() - new Date(act.planned_start).getTime();
        plannedPct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
      }
      byUnit[unitName].planned.push(plannedPct);
      byUnit[unitName].actual.push(Number(act.progress_percent ?? 0));
    }
  }

  const units = Object.entries(byUnit)
    .map(([unit, d]) => ({
      unit,
      planned:
        d.planned.length > 0
          ? Math.round(d.planned.reduce((a, b) => a + b, 0) / d.planned.length)
          : 0,
      actual:
        d.actual.length > 0
          ? Math.round(d.actual.reduce((a, b) => a + b, 0) / d.actual.length)
          : 0,
    }))
    .sort((a, b) => a.unit.localeCompare(b.unit));

  return NextResponse.json({ units });
});
