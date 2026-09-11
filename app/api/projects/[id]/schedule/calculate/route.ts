import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { SchedulingService } from '@/modules/Scheduling/Services/SchedulingService';

/**
 * Project CPM — SchedulingService, not M11 ScheduleOrchestrationService.
 */
export const POST = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const result = await SchedulingService.calculateProjectSchedule(projectId, orgId);
  return NextResponse.json(result);
});
