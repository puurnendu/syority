import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { assetId } = await ctx.params;

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  const [nozzles, lineLists, previousWorkpacks] = await Promise.all([
    prisma.nozzle.findMany({
      where: { asset_id: assetId, deleted_at: null },
      orderBy: [{ sequence_number: 'asc' }, { designation: 'asc' }],
      include: { joint_master: { select: { id: true, joint_number: true } } },
    }),
    prisma.lineList.findMany({
      where: {
        deleted_at: null,
        OR: [{ from_asset_id: assetId }, { to_asset_id: assetId }],
      },
      select: {
        id: true,
        line_number: true,
        total_joint_count: true,
        joints: { select: { id: true, joint_number: true } },
      },
    }),
    prisma.workpack.findMany({
      where: { asset_id: assetId, deleted_at: null },
      select: { id: true, title: true, workpack_id_code: true, status: true, updated_at: true },
      orderBy: { updated_at: 'desc' },
      take: 3,
    }),
  ]);

  return NextResponse.json({
    nozzles,
    line_lists: lineLists,
    existing_documents: [],
    certificate_templates: [],
    previous_workpacks: previousWorkpacks,
  });
}
