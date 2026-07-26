import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const url = new URL(req.url);
  const equipTypeId = url.searchParams.get('equipTypeId') ?? '';
  const projectId = url.searchParams.get('projectId') ?? undefined;

  const equipType = await prisma.equipmentType.findFirst({
    where: { id: equipTypeId, orgId },
    select: { name: true },
  });
  if (!equipType) return NextResponse.json({ workpacks: [] });

  const workpacks = await prisma.workpack.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
      ...(projectId
        ? {
            OR: [
              { project_id: projectId },
              { event_id: projectId },
            ],
          }
        : {}),
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
