import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const url = new URL(req.url);
  const equipTypeId = url.searchParams.get('equipTypeId') ?? '';
  // OD9.2 §6: PROJECT and STO scope are separate parameters. This previously accepted a
  // single `projectId` and matched it against BOTH `project_id` and `event_id`, treating
  // one identifier as ambiguously owned by both domains.
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const eventId = url.searchParams.get('eventId') ?? undefined;

  const equipType = await prisma.equipmentType.findFirst({
    where: { id: equipTypeId, org_id: orgId },
    select: { name: true },
  });
  if (!equipType) return NextResponse.json({ workpacks: [] });

  const workpacks = await prisma.workpack.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
      ...(projectId ? { project_id: projectId } : {}),
      ...(eventId ? { event_id: eventId } : {}),
      equipment_type: { contains: equipType.name, mode: 'insensitive' },
    },
    select: {
      id: true,
      workpack_number: true,
      workpack_id_code: true,
      title: true,
      _count: { select: { activities: true } },
    },
  });

  return NextResponse.json({
    workpacks: workpacks.map((w) => ({
      id: w.id,
      workpack_number: w.workpack_number ?? w.workpack_id_code,
      title: w.title,
      _count: w._count,
    })),
  });
}
