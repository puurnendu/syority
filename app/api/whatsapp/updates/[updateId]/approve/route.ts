import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/services/whatsapp/MetaClient';
import { buildReply } from '@/services/whatsapp/ReplyBuilder';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ updateId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { updateId } = await context.params;

  const body = await req.json().catch(() => ({}));
  const activityId = body.activity_id as string | undefined;
  const reviewNotes = body.review_notes as string | undefined;

  const update = await prisma.whatsappUpdate.findFirst({
    where: { id: updateId, organization_id: orgId },
    select: {
      id: true,
      phone_number: true,
      extracted_progress: true,
      matched_workpack_id: true,
      matched_activity_id: true,
      match_candidates: true,
      detected_language: true,
    },
  });

  if (!update) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const targetActivityId =
    activityId ?? update.matched_activity_id ?? (update.match_candidates as Array<{ activity_id: string | null }>)?.[0]?.activity_id ?? null;
  const progress = update.extracted_progress ?? 0;
  const workpackId = update.matched_workpack_id;

  if (targetActivityId && workpackId) {
    await prisma.activity.update({
      where: { id: targetActivityId },
      data: {
        progress_percent: progress,
        status: progress >= 100 ? 'completed' : 'in_progress',
        updated_by: userId,
      },
    });
    const activities = await prisma.activity.findMany({
      where: { workpack_id: workpackId, deleted_at: null },
      select: { progress_percent: true },
    });
    if (activities.length > 0) {
      const avg =
        activities.reduce((s, a) => s + (a.progress_percent ?? 0), 0) /
        activities.length;
      await prisma.workpack.update({
        where: { id: workpackId },
        data: { overall_progress: Math.round(avg), updated_by: userId },
      });
    }
  }

  const candidates = (update.match_candidates ?? []) as Array<{
    workpack_code: string;
    activity_id: string | null;
    activity_desc: string | null;
  }>;
  const chosen =
    candidates.find((c) => c.activity_id === targetActivityId) ?? candidates[0];

  const replyText = buildReply(
    'confirmed',
    update.detected_language ?? 'en',
    {
      workpack: chosen?.workpack_code ?? '',
      activity: chosen?.activity_desc ?? 'workpack',
      progress,
      time: new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }),
    }
  );
  await sendWhatsAppMessage(update.phone_number, replyText);

  const updated = await prisma.whatsappUpdate.update({
    where: { id: updateId },
    data: {
      status: 'approved_planner',
      review_notes: reviewNotes ?? null,
      reviewed_by: userId,
      reviewed_at: new Date(),
      reply_sent: replyText,
      reply_sent_at: new Date(),
      reply_language: update.detected_language ?? undefined,
    },
  });

  return NextResponse.json(updated);
}
