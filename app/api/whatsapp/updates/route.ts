import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('page_size') ?? '20', 10)));
  const skip = (page - 1) * pageSize;

  const where: { organization_id: string; status?: string } = {
    organization_id: orgId,
  };
  if (status) where.status = status;

  const [updates, total, pendingCount, todayCount] = await Promise.all([
    prisma.whatsappUpdate.findMany({
      where,
      select: {
        id: true,
        phone_number: true,
        message_type: true,
        raw_message_text: true,
        detected_language: true,
        extracted_unit: true,
        extracted_tag: true,
        extracted_description: true,
        extracted_progress: true,
        confidence_breakdown: true,
        final_confidence: true,
        matched_workpack_id: true,
        match_candidates: true,
        status: true,
        audio_storage_path: true,
        audio_duration_secs: true,
        user: { select: { name: true } },
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.whatsappUpdate.count({ where }),
    prisma.whatsappUpdate.count({
      where: { organization_id: orgId, status: 'parked_review' },
    }),
    prisma.whatsappUpdate.count({
      where: {
        organization_id: orgId,
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: updates,
    total,
    page,
    page_size: pageSize,
    pending_count: pendingCount,
    today_count: todayCount,
  });
}
