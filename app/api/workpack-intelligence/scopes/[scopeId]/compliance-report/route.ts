import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { ComplianceScoreService } from '@/core/workpack-intelligence';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ scopeId: string }> }) {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  const { scopeId } = await params;

  const instantiations = await prisma.workpackInstantiation.findMany({
    where: { scope_id: scopeId },
    select: { workpack_id: true },
  });

  const results = [];
  for (const inst of instantiations) {
    try {
      const compliance = await ComplianceScoreService.computeCompliance(inst.workpack_id);
      const wp = await prisma.workpack.findUnique({
        where: { id: inst.workpack_id },
        select: { workpack_number: true, title: true },
      });
      results.push({
        workpackId: inst.workpack_id,
        workpackNumber: wp?.workpack_number || null,
        title: wp?.title || '',
        ...compliance,
      });
    } catch { /* skip */ }
  }

  return NextResponse.json({ data: results });
}
