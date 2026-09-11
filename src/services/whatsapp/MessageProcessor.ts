/**
 * Core message processing pipeline. Runs after webhook has ACK'd Meta.
 */

import { prisma } from '@/lib/prisma';
import { processVoiceNote } from './AudioProcessor';
import { extractFields } from './FieldExtractor';
import { matchToDatabase, type MatchCandidate } from './DbMatcher';
import { buildReply } from './ReplyBuilder';
import { sendWhatsAppMessage } from './MetaClient';
import { handleQuery } from './QueryHandler';

type MetaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'audio' | 'image' | 'document';
  text?: { body: string };
  audio?: { id: string; mime_type: string };
};

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaMessage[];
        metadata?: { phone_number_id: string };
      };
    }>;
  }>;
};

export async function processInboundMessage(payload: unknown): Promise<void> {
  const p = payload as MetaWebhookPayload;
  const messages = p?.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!messages?.length) return;
  for (const msg of messages) {
    try {
      await processSingleMessage(msg);
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`[WhatsApp] Failed msg ${msg.id}:`, err?.message);
    }
  }
}

async function processSingleMessage(msg: MetaMessage): Promise<void> {
  const phone = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;

  const existing = await prisma.whatsapp_updates.findFirst({
    where: { meta_message_id: msg.id },
  });
  if (existing) return;

  const user = await prisma.user.findFirst({
    where: { whatsapp_number: phone, is_active: true },
    select: {
      id: true,
      organization_id: true,
      name: true,
      preferred_language: true,
      whatsapp_number: true,
    },
  });

  if (!user) {
    await sendWhatsAppMessage(phone, buildReply('unregistered', 'en'));
    await prisma.whatsapp_updates.create({
      data: {
        phone_number: phone,
        meta_message_id: msg.id,
        message_type: msg.type === 'audio' ? 'voice' : 'text',
        status: 'unregistered',
        raw_message_text: msg.text?.body ?? null,
      },
    });
    return;
  }

  const orgId = user.organization_id!;
  const lang = user.preferred_language ?? 'en';

  const session = await prisma.whatsapp_sessions.findFirst({
    where: { phone_number: phone },
  });
  const isSessionReply =
    session && session.expires_at > new Date() && session.state !== 'idle';

  if (isSessionReply && session) {
    await handleSessionReply(msg, phone, user, session, lang);
    return;
  }

  const whisperKey =
    process.env.WHATSAPP_OPENAI_API_KEY ?? (await getKeyFromDb(orgId, 'whisper'));
  const gptKey =
    process.env.WHATSAPP_OPENAI_API_KEY ?? (await getKeyFromDb(orgId, 'whatsapp'));
  const gptModel = 'gpt-4o-mini';

  let transcript = '';
  let messageType: 'text' | 'voice' = 'text';
  let audioStoragePath: string | null = null;
  let audioDuration: number | null = null;
  let audioSize: bigint | null = null;
  let detectedLang = lang;

  if (msg.type === 'audio' && msg.audio?.id) {
    messageType = 'voice';
    const audio = await processVoiceNote(msg.audio.id, whisperKey);
    transcript = audio.transcript;
    detectedLang = audio.detectedLanguage;
    audioStoragePath = audio.storagePath;
    audioDuration = audio.durationSecs;
    audioSize = BigInt(audio.fileSizeBytes);
    if (['en', 'hi', 'gu', 'ta', 'ml'].includes(detectedLang) && detectedLang !== lang) {
      await prisma.user.update({
        where: { id: user.id },
        data: { preferred_language: detectedLang },
      });
    }
  } else if (msg.type === 'text' && msg.text?.body) {
    transcript = msg.text.body;
  } else {
    await sendWhatsAppMessage(phone, buildReply('ask_resend', lang));
    return;
  }

  const extracted = await extractFields(transcript, {
    apiKey: gptKey,
    model: gptModel,
  });

  if (extracted.is_query || extracted.detected_intent === 'query') {
    const reply = await handleQuery(extracted, user, orgId, detectedLang);
    await sendWhatsAppMessage(phone, reply);
    await prisma.whatsapp_updates.create({
      data: {
        organization_id: orgId,
        user_id: user.id,
        phone_number: phone,
        meta_message_id: msg.id,
        message_type: messageType,
        raw_message_text: transcript,
        detected_language: detectedLang,
        audio_storage_path: audioStoragePath,
        audio_duration_secs: audioDuration,
        audio_file_size_bytes: audioSize,
        status: 'query',
        reply_sent: reply,
        reply_sent_at: new Date(),
        reply_language: detectedLang,
      },
    });
    return;
  }

  const match = await matchToDatabase(
    orgId,
    {
      unit_name: extracted.unit_name,
      equipment_tag: extracted.equipment_tag,
      job_description: extracted.job_description,
    },
    user.id
  );

  const aiConfidence = extracted.confidence.overall;
  const dbConfidence = match.db_confidence;
  const finalConfidence = aiConfidence * 0.6 + dbConfidence * 0.4;

  const confidenceBreakdown = {
    unit_name: {
      score: extracted.confidence.unit_name,
      flag: extracted.flags.unit_name,
    },
    equipment_tag: {
      score: extracted.confidence.equipment_tag,
      flag: extracted.flags.equipment_tag,
    },
    job_description: {
      score: extracted.confidence.job_description,
      flag: extracted.flags.job_description,
    },
    progress_percent: {
      score: extracted.confidence.progress_percent,
      flag: extracted.flags.progress_percent,
    },
    overall: finalConfidence,
  };

  let status: string;
  let replySent: string;

  if (
    extracted.missing_fields.includes('unit_name') &&
    !match.unit_matched
  ) {
    status = 'pending';
    replySent = buildReply('ask_unit', detectedLang, {
      tag: extracted.equipment_tag ?? '?',
    });
    await upsertSession(phone, orgId, user.id, {
      state: 'awaiting_unit',
      pending_data: { extracted, match_result: match },
      detected_language: detectedLang,
    });
  } else if (!match.asset_matched) {
    status = 'pending';
    replySent = buildReply('tag_not_found', detectedLang, {
      tag: extracted.equipment_tag ?? '?',
    });
  } else if (!match.best_match) {
    status = 'pending';
    replySent = buildReply('no_active_workpack', detectedLang, {
      tag: extracted.equipment_tag ?? '?',
    });
  } else if (
    match.activity_ambiguous &&
    match.all_candidates.length > 1
  ) {
    status = 'pending';
    const list = match.all_candidates
      .slice(0, 4)
      .map((c, i) => `${i + 1}. ${c.activity_desc ?? c.workpack_code}`)
      .join('\n');
    replySent = buildReply('ask_activity', detectedLang, {
      count: match.all_candidates.length,
      list,
    });
    await upsertSession(phone, orgId, user.id, {
      state: 'awaiting_activity',
      pending_data: {
        extracted,
        candidates: match.all_candidates,
        progress: extracted.progress_percent,
      },
      detected_language: detectedLang,
    });
  } else if (finalConfidence >= 0.9) {
    // M16-R5 P0-1: conversational WhatsApp MUST NOT auto-execute via EWS.
    // High-confidence matches are parked for governed pipeline / planner review.
    status = 'parked_review';
    replySent = buildReply('parked', detectedLang, {
      workpack: match.best_match.workpack_code,
      activity: match.best_match.activity_desc ?? 'workpack',
      progress: extracted.progress_percent ?? 0,
    });
  } else if (finalConfidence >= 0.75) {
    status = 'parked_review';
    replySent = buildReply('parked', detectedLang, {
      workpack: match.best_match.workpack_code,
      activity: match.best_match.activity_desc ?? 'workpack',
      progress: extracted.progress_percent ?? 0,
    });
  } else {
    status = 'rejected_confidence';
    replySent = buildReply('ask_resend', detectedLang);
  }

  await sendWhatsAppMessage(phone, replySent);

  await prisma.whatsapp_updates.create({
    data: {
      organization_id: orgId,
      user_id: user.id,
      phone_number: phone,
      meta_message_id: msg.id,
      message_type: messageType,
      raw_message_text: transcript,
      detected_language: detectedLang,
      audio_storage_path: audioStoragePath,
      audio_duration_secs: audioDuration,
      audio_file_size_bytes: audioSize,
      extracted_unit: extracted.unit_name,
      extracted_tag: extracted.equipment_tag,
      extracted_description: extracted.job_description,
      extracted_progress: extracted.progress_percent,
      confidence_breakdown: confidenceBreakdown,
      ai_confidence: aiConfidence,
      db_confidence: dbConfidence,
      final_confidence: finalConfidence,
      matched_workpack_id: match.best_match?.workpack_id ?? null,
      matched_activity_id: match.best_match?.activity_id ?? null,
      match_candidates: match.all_candidates,
      status,
      reply_sent: replySent,
      reply_sent_at: new Date(),
      reply_language: detectedLang,
    },
  });
}

async function applyProgressUpdate(
  _match: { workpack_id: string; activity_id: string | null; organization_id?: string },
  _progress: number,
  _userId: string,
  _orgId: string
): Promise<{ success: boolean; error?: string }> {
  // Conversational auto-apply is disabled. Governed path is the M16 pipeline only.
  return {
    success: false,
    error: 'WhatsApp auto-execution is disabled. Use the governed M16 WhatsApp pipeline.',
  };
}

async function upsertSession(
  phone: string,
  orgId: string,
  userId: string,
  data: {
    state: string;
    pending_data: object;
    detected_language: string;
  }
): Promise<void> {
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.whatsapp_sessions.upsert({
    where: { phone_number: phone },
    create: {
      phone_number: phone,
      organization_id: orgId,
      user_id: userId,
      state: data.state,
      pending_data: data.pending_data,
      detected_language: data.detected_language,
      expires_at: expires,
    },
    update: {
      state: data.state,
      pending_data: data.pending_data,
      detected_language: data.detected_language,
      expires_at: expires,
    },
  });
}

async function handleSessionReply(
  msg: MetaMessage,
  phone: string,
  user: { id: string; organization_id: string | null },
  session: {
    state: string;
    pending_data: unknown;
    detected_language: string | null;
  },
  lang: string
): Promise<void> {
  const text = (msg.text?.body ?? '').trim();
  const orgId = user.organization_id!;
  const dl = session.detected_language ?? lang;

  if (session.state === 'awaiting_activity') {
    const choice = parseInt(text, 10);
    const pending = session.pending_data as {
      candidates?: MatchCandidate[];
      progress?: number;
    };
    const candidates = pending?.candidates ?? [];
    const selected = candidates[choice - 1];

    if (!selected || isNaN(choice)) {
      await sendWhatsAppMessage(phone, buildReply('ask_resend', dl));
      return;
    }

    const progress = pending?.progress ?? 0;
    const result = await applyProgressUpdate(selected, progress, user.id, orgId);

    let reply: string;
    if (result.success) {
      reply = buildReply('confirmed', dl, {
        workpack: selected.workpack_code,
        activity: selected.activity_desc ?? '',
        progress,
        time: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
        }),
      });
    } else {
      reply = buildReply('parked', dl, {
        workpack: selected.workpack_code,
        activity: selected.activity_desc ?? '',
        progress,
      });
    }
    await sendWhatsAppMessage(phone, reply);

    await prisma.whatsapp_updates.create({
      data: {
        organization_id: orgId,
        user_id: user.id,
        phone_number: phone,
        meta_message_id: msg.id,
        message_type: 'text',
        raw_message_text: text,
        extracted_progress: progress,
        matched_workpack_id: selected.workpack_id,
        matched_activity_id: selected.activity_id,
        status: 'auto_updated',
        reply_sent: reply,
        reply_sent_at: new Date(),
      },
    });
  }

  if (session.state === 'awaiting_unit') {
    const pending = (session.pending_data ?? {}) as {
      extracted?: { unit_name?: string; equipment_tag?: string; job_description?: string; progress_percent?: number };
      match_result?: unknown;
    };
    const extracted = { ...(pending.extracted ?? {}) };
    extracted.unit_name = text;

    const match = await matchToDatabase(orgId, {
      unit_name: extracted.unit_name ?? null,
      equipment_tag: extracted.equipment_tag ?? null,
      job_description: extracted.job_description ?? null,
    }, user.id);

    await prisma.whatsapp_sessions.update({
      where: { phone_number: phone },
      data: { state: 'idle', pending_data: undefined },
    });

    if (match.best_match) {
      const prog = extracted.progress_percent ?? 0;
      const result = await applyProgressUpdate(match.best_match, prog, user.id, orgId);
      let reply: string;
      if (result.success) {
        reply = buildReply('confirmed', dl, {
          workpack: match.best_match.workpack_code,
          activity: match.best_match.activity_desc ?? '',
          progress: prog,
          time: new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Kolkata',
          }),
        });
      } else {
        reply = buildReply('parked', dl, {
          workpack: match.best_match.workpack_code,
          activity: match.best_match.activity_desc ?? '',
          progress: prog,
        });
      }
      await sendWhatsAppMessage(phone, reply);
    } else {
      await sendWhatsAppMessage(phone, buildReply('ask_resend', dl));
    }
  }

  await prisma.whatsapp_sessions.update({
    where: { phone_number: phone },
    data: {
      state: 'idle',
      pending_data: undefined,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

async function getKeyFromDb(
  orgId: string,
  keyType: 'whisper' | 'whatsapp'
): Promise<string> {
  const s = await prisma.aiProviderSetting.findFirst({
    where: { organization_id: orgId, is_active: true },
  });
  const key =
    keyType === 'whisper'
      ? (s?.whisper_api_key_encrypted ??
        s?.whatsapp_api_key_encrypted ??
        s?.api_key_encrypted)
      : (s?.whatsapp_api_key_encrypted ?? s?.api_key_encrypted);
  if (!key) throw new Error(`No ${keyType} API key`);
  return key;
}
