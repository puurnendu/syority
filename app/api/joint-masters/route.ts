import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const url = new URL(req.url);
  const asset_id = url.searchParams.get('asset_id') ?? undefined;
  const line_id = url.searchParams.get('line_id') ?? undefined;
  const unit_id = url.searchParams.get('unit_id') ?? undefined;
  const site_id = url.searchParams.get('site_id') ?? undefined;
  const where: Prisma.JointMasterWhereInput = {
    organization_id: orgId,
    is_active: true,
  };
  if (asset_id) where.asset_id = asset_id;
  if (line_id) where.line_id = line_id;
  if (site_id) where.site_id = site_id;
  if (unit_id) where.OR = [{ line_lists: { unit_id } }, { Asset: { system: { unit_id } } }];
  const joints = await prisma.joint_masters.findMany({
    where,
    include: {
      Asset: { select: { id: true, tag_number: true, name: true } },
      line_lists: { select: { id: true, line_number: true } },
      nozzles: { select: { id: true, designation: true } },
    },
    orderBy: [{ joint_number: 'asc' }],
  });
  return NextResponse.json({ data: joints });
}
