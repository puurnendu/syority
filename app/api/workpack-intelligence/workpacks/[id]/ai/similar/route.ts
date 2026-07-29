import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackAiService } from '@/core/workpack-intelligence';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  // Get workpack to determine equipment type
  const { prisma } = await import('@/lib/prisma');
  const wp = await prisma.workpack.findUnique({
    where: { id },
    select: { equipment_type: true, template_id: true },
  });

  const result = await WorkpackAiService.findSimilarWorkpacks(orgId, {
    equipmentType: wp?.equipment_type || searchParams.get('equipment_type') || undefined,
    templateId: wp?.template_id || undefined,
  });

  return NextResponse.json({ data: result });
}
