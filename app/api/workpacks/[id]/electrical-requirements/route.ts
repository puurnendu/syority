import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id: workpackId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Activities with electrical materials (WorkpackMaterial)
  const activities = await prisma.activity.findMany({
    where: { workpack_id: workpackId, deleted_at: null },
    include: {
      materials: {
        where: { material_category: 'electrical' },
      },
    },
  });

  const aggregated = new Map<
    string,
    {
      description: string;
      uom: string;
      quantity: number;
      justification: string;
      activityCodes: string[];
    }
  >();

  for (const activity of activities) {
    for (const mat of activity.materials) {
      const key = `${(mat.description ?? '').toLowerCase().trim()}__${mat.unit_of_measure ?? 'NOS'}`;
      const qty = Number(mat.quantity_required) ?? 0;
      const actCode = activity.activity_id ?? activity.activity_number ?? '';
      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.quantity += qty;
        if (actCode && !existing.activityCodes.includes(actCode)) {
          existing.activityCodes.push(actCode);
        }
        const actDesc = (activity.description ?? '').slice(0, 120);
        if (actDesc && !existing.justification.includes(actDesc.slice(0, 30))) {
          existing.justification += `; ${actDesc}`;
        }
      } else {
        aggregated.set(key, {
          description: mat.description ?? '',
          uom: mat.unit_of_measure ?? 'NOS',
          quantity: qty || 1,
          justification: (activity.description ?? '').slice(0, 160),
          activityCodes: actCode ? [actCode] : [],
        });
      }
    }
  }

  // WorkpackMaterialLine (electrical) — no activity link
  const lines = await prisma.workpackMaterialLine.findMany({
    where: {
      workpack_id: workpackId,
      material_category: 'electrical',
      deleted_at: null,
    },
  });

  for (const line of lines) {
    const key = `${(line.description ?? '').toLowerCase().trim()}__${line.unit_of_measure ?? 'NOS'}`;
    const qty = Number(line.quantity_required) ?? 0;
    if (aggregated.has(key)) {
      const existing = aggregated.get(key)!;
      existing.quantity += qty;
    } else {
      aggregated.set(key, {
        description: line.description ?? '',
        uom: line.unit_of_measure ?? 'NOS',
        quantity: qty || 1,
        justification: '',
        activityCodes: [],
      });
    }
  }

  const items = Array.from(aggregated.values());
  return NextResponse.json({ items });
}
