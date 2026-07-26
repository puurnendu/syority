import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ lineId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { lineId } = await ctx.params;
  const line = await prisma.lineList.findFirst({
    where: { id: lineId, organization_id: orgId, deleted_at: null },
    select: { id: true, line_number: true, site_id: true, total_joint_count: true },
  });
  if (!line) return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const totalJointCount = body.total_joint_count != null ? Math.max(0, Number(body.total_joint_count)) : (line.total_joint_count ?? 0);
  if (totalJointCount <= 0) return NextResponse.json({ error: 'total_joint_count must be > 0' }, { status: 400 });
  const existingCount = await prisma.jointMaster.count({ where: { line_id: lineId } });
  if (existingCount > 0) return NextResponse.json({ created: 0, skipped: existingCount, message: 'Joints already exist for this line' });
  const jointNumbers = Array.from({ length: totalJointCount }, (_, i) => line.line_number + '-J' + String(i + 1).padStart(3, '0'));
  await prisma.jointMaster.createMany({
    data: jointNumbers.map((joint_number, idx) => ({
      organization_id: orgId,
      site_id: line.site_id,
      line_id: lineId,
      sequence_in_line: idx + 1,
      joint_number,
      joint_type: 'flanged',
      created_by: userId,
    })),
  });
  if (line.total_joint_count !== totalJointCount) {
    await prisma.lineList.update({ where: { id: lineId }, data: { total_joint_count: totalJointCount } });
  }
  return NextResponse.json({ created: totalJointCount, skipped: 0 });
}
