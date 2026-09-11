import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = req.nextUrl;
  const unitId = searchParams.get('unit_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('page_size') ?? '20', 10)));
  const skip = (page - 1) * pageSize;

  const where: {
    organization_id: string;
    unit_id?: string;
    shift_start?: { gte?: Date; lte?: Date };
  } = { organization_id: orgId };
  if (unitId) where.unit_id = unitId;
  if (dateFrom || dateTo) {
    where.shift_start = {};
    if (dateFrom) where.shift_start.gte = new Date(dateFrom);
    if (dateTo) where.shift_start.lte = new Date(dateTo);
  }

  const data = await prisma.shift_reports.findMany({
    where,
    orderBy: { shift_start: 'desc' },
    skip,
    take: pageSize,
  });

  return NextResponse.json({ data });
}
