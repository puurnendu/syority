import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/services/whatsapp/MetaClient';

const REJECT_MESSAGE: Record<string, string> = {
  en: 'Your update was reviewed and rejected by the planner. Reason: {notes}. Please re-submit.',
  hi: 'Planner ne aapka update reject kar diya. Reason: {notes}. Phir se bhejein.',
  gu: 'Planner e tamaro update reject karyu. Reason: {notes}. Pharthi moklo.',
  ta: 'திட்டமிடுபவர் உங்கள் புதுப்பிப்பை நிராகரித்தார். காரணம்: {notes}. மீண்டும் அனுப்பவும்.',
  ml: 'പ്ലാനർ നിങ്ങളുടെ അപ്‌ഡേറ്റ് നിരാകരിച്ചു. കാരണം: {notes}. വീണ്ടും അയക്കുക.',
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ updateId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { updateId } = await context.params;

  const body = await req.json().catch(() => ({}));
  const reviewNotes = (body.review_notes as string)?.trim();
  if (!reviewNotes) {
    return NextResponse.json(
      { error: 'review_notes is required' },
      { status: 400 }
    );
  }

  const update = await prisma.whatsappUpdate.findFirst({
    where: { id: updateId, organization_id: orgId },
    select: {
      id: true,
      phone_number: true,
      detected_language: true,
    },
  });

  if (!update) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const lang = update.detected_language ?? 'en';
  const template = REJECT_MESSAGE[lang] ?? REJECT_MESSAGE.en;
  const replyText = template.replace('{notes}', reviewNotes);
  await sendWhatsAppMessage(update.phone_number, replyText);

  const updated = await prisma.whatsappUpdate.update({
    where: { id: updateId },
    data: {
      status: 'rejected_planner',
      review_notes: reviewNotes,
      reviewed_by: userId,
      reviewed_at: new Date(),
      reply_sent: replyText,
      reply_sent_at: new Date(),
      reply_language: lang,
    },
  });

  return NextResponse.json(updated);
}
