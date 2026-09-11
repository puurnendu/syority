/**
 * M16-R4 — WhatsApp Channel Adapter
 *
 * THE SINGLE ENTRY POINT for all WhatsApp interactions into M16.
 *
 * This is a CHANNEL ADAPTER — it transforms WhatsApp transport into
 * M16InteractionPipeline calls. It does NOT contain domain logic.
 *
 * Flow:
 *   1. HMAC signature verification (WebhookSignatureVerifier)
 *   2. Rate limiting (rateLimiter.webhook)
 *   3. Idempotency check (meta_message_id)
 *   4. Audio transcription (AudioProcessor) — if voice note
 *   5. Identity resolution (IdentityResolver.resolveWhatsAppIdentity)
 *   6. User role resolution (for fail-closed auth)
 *   7. Event context resolution (with ambiguity → ASK)
 *   8. Build M16InteractionContext (InteractionContextBuilder)
 *   9. processInteraction() — M16 pipeline
 *  10. Format response for WhatsApp (ReplyBuilder extensions)
 *  11. Send reply via MetaClient
 *  12. Transport audit (whatsapp_updates)
 *
 * SECURITY:
 *   - All identity from IdentityResolver — NEVER from LLM
 *   - All authorization from M16AuthorizationBoundary — NEVER from WhatsApp
 *   - All confirmation from R3 ConfirmationGate — no WhatsApp-specific gate
 *   - All execution from R3 writeTools → EWS.applyAction()
 *   - Phone number = identity lookup mechanism, NOT authorization
 *
 * DOES NOT:
 *   - Calculate progress (M8.13)
 *   - Calculate CPM/schedule (M11)
 *   - Write to Prisma domain tables
 *   - Create an alternate execution path
 *   - Implement a second confirmation mechanism
 */

import { prisma } from '@/lib/prisma';
import { verifyMetaWebhookSignature } from '../security/WebhookSignatureVerifier';
import { resolveWhatsAppIdentity } from '../security/IdentityResolver';
import { resolveEventContext } from '../context/EventContextResolver';
import { buildInteractionContext } from '../context/InteractionContextBuilder';
import { processInteraction } from '../pipeline/M16InteractionPipeline';
import { createGovernedPipelineDependencies } from '../pipeline/governedPipelineDeps';
import { logInteraction } from '../audit/M16InteractionAuditService';
import { resolveEntityChain } from '../entity/M16EntityResolver';
import { classifyUserIntent } from '../intent/IntentClassifier';
import { detectInjectionPatterns } from '../security/PromptInjectionBoundary';
import { checkRateLimit } from '@/lib/rateLimiter';
import { processVoiceNote } from '@/services/whatsapp/AudioProcessor';
import { sendWhatsAppMessage } from '@/services/whatsapp/MetaClient';
import { buildReply } from '@/services/whatsapp/ReplyBuilder';
import type { M16InteractionContext, EventContextResult } from '../types';
import type { PipelineDependencies, PipelineOutput } from '../pipeline/M16InteractionPipeline';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppWebhookRequest {
  /** Raw body string for HMAC verification */
  rawBody: string;
  /** X-Hub-Signature-256 header value */
  signature: string;
  /** Parsed webhook payload */
  payload: MetaWebhookPayload;
}

export interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaMessage[];
        metadata?: { phone_number_id: string };
      };
    }>;
  }>;
}

export interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'audio' | 'image' | 'document';
  text?: { body: string };
  audio?: { id: string; mime_type: string };
}

export interface WhatsAppProcessingResult {
  status: 'processed' | 'rejected' | 'error';
  reason?: string;
  messageId?: string;
  pipelineOutput?: PipelineOutput;
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Process an inbound WhatsApp webhook request.
 *
 * This is the R4 entry point — ALL WhatsApp traffic MUST come through here.
 *
 * @param request - Raw webhook request with body, signature, and parsed payload
 * @param appSecret - Meta app secret for HMAC verification
 * @param deps - Pipeline dependencies (LLM caller, entity resolver, logger)
 */
export async function processWhatsAppWebhook(
  request: WhatsAppWebhookRequest,
  appSecret: string,
  deps: PipelineDependencies
): Promise<WhatsAppProcessingResult[]> {
  // ── Step 1: HMAC Signature Verification ──────────────────────────────────
  if (!appSecret) {
    return [{ status: 'rejected', reason: 'HMAC secret not configured' }];
  }

  const signatureValid = verifyMetaWebhookSignature(
    Buffer.isBuffer(request.rawBody) ? request.rawBody : Buffer.from(request.rawBody, 'utf-8'),
    request.signature,
    appSecret
  );

  if (!signatureValid) {
    return [{ status: 'rejected', reason: 'Invalid webhook signature' }];
  }

  // ── Step 2: Extract Messages ──────────────────────────────────────────────
  const messages = request.payload?.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!messages?.length) {
    return [{ status: 'processed', reason: 'No messages in payload' }];
  }

  // Process each message
  const results: WhatsAppProcessingResult[] = [];
  for (const msg of messages) {
    try {
      const result = await processWhatsAppMessage(msg, deps);
      results.push(result);
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`[M16-R4] Failed to process WhatsApp msg ${msg.id}:`, error?.message);
      results.push({ status: 'error', reason: error?.message ?? 'Unknown error', messageId: msg.id });
    }
  }

  return results;
}

// ── Single Message Processing ─────────────────────────────────────────────────

async function processWhatsAppMessage(
  msg: MetaMessage,
  deps: PipelineDependencies
): Promise<WhatsAppProcessingResult> {
  const phone = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;

  // ── Step 3: Rate Limit ────────────────────────────────────────────────────
  const rateResult = await checkRateLimit(phone, 'webhook');
  if (!rateResult.allowed) {
    return { status: 'rejected', reason: 'Rate limit exceeded', messageId: msg.id };
  }

  // ── Step 4: Idempotency Check ─────────────────────────────────────────────
  const existing = await prisma.whatsapp_updates.findFirst({
    where: { meta_message_id: msg.id },
  });
  if (existing) {
    return { status: 'processed', reason: 'Duplicate message (idempotent)', messageId: msg.id };
  }

  // ── Step 5: Identity Resolution ───────────────────────────────────────────
  const identityResult = await resolveWhatsAppIdentity(phone);

  if (identityResult.status === 'not_found') {
    await sendWhatsAppMessage(phone, buildReply('unregistered', 'en'));
    await recordWhatsAppUpdate(msg, phone, null, null, 'unregistered');
    return { status: 'rejected', reason: 'Unregistered phone number', messageId: msg.id };
  }

  if (identityResult.status === 'rejected') {
    const reasonMap = {
      not_verified: 'WhatsApp number not verified',
      not_opted_in: 'WhatsApp opt-in required',
      inactive: 'User account inactive',
    };
    await sendWhatsAppMessage(phone, buildReply('identity_rejected', 'en', {
      reason: reasonMap[identityResult.reason],
    }));
    await recordWhatsAppUpdate(msg, phone, null, null, `rejected_${identityResult.reason}`);
    return { status: 'rejected', reason: reasonMap[identityResult.reason], messageId: msg.id };
  }

  const identity = identityResult.identity;
  const orgId = identity.organizationId;
  const lang = identity.preferredLanguage ?? 'en';

  // ── Step 6: Transcription (if audio) ──────────────────────────────────────
  let transcript = '';
  let messageType: 'text' | 'voice' = 'text';

  if (msg.type === 'audio' && msg.audio?.id) {
    messageType = 'voice';
    try {
      const whisperKey = await getProviderKey(orgId, 'whisper');
      const audio = await processVoiceNote(msg.audio.id, whisperKey);
      transcript = audio.transcript;
    } catch (err: unknown) {
      const error = err as Error;
      await sendWhatsAppMessage(phone, buildReply('ask_resend', lang));
      await recordWhatsAppUpdate(msg, phone, orgId, identity.userId, 'transcription_failed');
      return { status: 'error', reason: `Transcription failed: ${error?.message}`, messageId: msg.id };
    }
  } else if (msg.type === 'text' && msg.text?.body) {
    transcript = msg.text.body;
  } else {
    await sendWhatsAppMessage(phone, buildReply('ask_resend', lang));
    await recordWhatsAppUpdate(msg, phone, orgId, identity.userId, 'unsupported_type');
    return { status: 'rejected', reason: 'Unsupported message type', messageId: msg.id };
  }

  // ── Step 7: User Role Resolution ──────────────────────────────────────────
  const userRole = await resolveUserRole(identity.userId, orgId);

  // ── Step 8: Event Context Resolution ──────────────────────────────────────
  // Check session for persisted event
  const session = await prisma.whatsapp_sessions.findFirst({
    where: { phone_number: phone },
  });
  const sessionEventId = session?.event_id ?? null;

  const eventResult = await resolveEventContext(orgId, 'whatsapp', sessionEventId);

  if (eventResult.resolution === 'AMBIGUOUS') {
    // ASK the user which event — do NOT guess
    const eventList = eventResult.candidates!
      .slice(0, 5)
      .map((e, i) => `${i + 1}. ${e.code} — ${e.name}`)
      .join('\n');

    await sendWhatsAppMessage(phone, buildReply('event_ambiguous', lang, {
      count: eventResult.candidates!.length,
      list: eventList,
    }));
    await recordWhatsAppUpdate(msg, phone, orgId, identity.userId, 'event_ambiguous');
    return { status: 'processed', reason: 'Event ambiguous — asked user', messageId: msg.id };
  }

  if (eventResult.resolution === 'NONE') {
    await sendWhatsAppMessage(phone, buildReply('no_active_event', lang));
    await recordWhatsAppUpdate(msg, phone, orgId, identity.userId, 'no_event');
    return { status: 'rejected', reason: 'No active events', messageId: msg.id };
  }

  // ── Step 8b: Prompt injection boundary (transcript is untrusted) ──────────
  const injectionHits = detectInjectionPatterns(transcript);
  const blockingInjection = injectionHits.some((h) =>
    ['ROLE_ESCALATION', 'AUTH_BYPASS', 'TENANT_OVERRIDE', 'TENANT_SWITCH', 'CONTEXT_OVERRIDE', 'EVENT_OVERRIDE'].includes(h)
  );
  if (blockingInjection) {
    await sendWhatsAppMessage(phone, 'That instruction cannot change identity, organization, or permissions.', orgId);
    await recordWhatsAppUpdate(msg, phone, orgId, identity.userId, 'prompt_injection_rejected');
    return { status: 'rejected', reason: 'Prompt injection patterns rejected', messageId: msg.id };
  }

  // ── Step 9: Build Trusted M16 Context ─────────────────────────────────────
  // Stable per phone so ConfirmationGate YES/NO survives across messages.
  const conversationId = `wa-${phone}`;
  const context = buildInteractionContext({
    identity,
    channel: 'whatsapp',
    conversationId,
    eventId: eventResult.eventId,
    siteId: eventResult.siteId,
    messageId: msg.id,
    identitySource: 'phone_number',
  });

  // Production: org-scoped governed deps. Vitest keeps injected mocks.
  const effectiveDeps = process.env.VITEST
    ? deps
    : createGovernedPipelineDependencies({
        organizationId: orgId,
        userId: identity.userId,
        channel: 'whatsapp',
        jobType: 'whatsapp_extraction',
      });

  // ── Step 10: M16 Interaction Pipeline ─────────────────────────────────────
  const pipelineOutput = await processInteraction(
    {
      text: transcript,
      context,
      // OD9.2 §20: `projectId` is no longer supplied. The pipeline never reads it, and
      // this passed an ORGANIZATION id through a Project-named field — a third distinct
      // identity travelling under the Project domain's name. Tenant scope reaches the
      // pipeline through `context`; STO campaign scope through `context.eventId`.
      userRole,
    },
    effectiveDeps
  );

  // ── Step 11: Format & Send WhatsApp Response ──────────────────────────────
  const replyText = formatPipelineOutputForWhatsApp(pipelineOutput, lang, context);
  await sendWhatsAppMessage(phone, replyText, orgId);

  // ── Step 12: Transport Audit ──────────────────────────────────────────────
  await recordWhatsAppUpdate(msg, phone, orgId, identity.userId,
    pipelineOutput.toolExecuted ? 'executed' : (pipelineOutput.pendingConfirmation ? 'pending_confirmation' : 'query'),
    transcript, replyText, pipelineOutput
  );

  return {
    status: 'processed',
    messageId: msg.id,
    pipelineOutput,
  };
}

// ── Response Formatting ───────────────────────────────────────────────────────

function formatPipelineOutputForWhatsApp(
  output: PipelineOutput,
  lang: string,
  _context: M16InteractionContext
): string {
  const response = output.response;

  // Pending confirmation → WhatsApp confirmation prompt
  if (output.pendingConfirmation) {
    return buildReply('confirmation_prompt', lang, {
      message: response.text,
    });
  }

  // Permission denied
  if (response.text.includes("don't have permission") || response.text.includes('denied')) {
    return buildReply('permission_denied', lang, {
      message: response.text,
    });
  }

  // Execution success
  if (output.toolExecuted && response.text) {
    return buildReply('execution_success', lang, {
      message: response.text,
    });
  }

  // Default — return the pipeline response text
  return response.text;
}

// ── Helper Functions ──────────────────────────────────────────────────────────

async function resolveUserRole(userId: string, orgId: string): Promise<string | null> {
  try {
    const membership = await prisma.organizationMembership.findFirst({
      where: { user_id: userId, organization_id: orgId },
      select: { role: true },
    });
    return membership?.role ?? null;
  } catch {
    return null;
  }
}

async function getProviderKey(orgId: string, keyType: 'whisper' | 'whatsapp'): Promise<string> {
  const envKey = process.env.WHATSAPP_OPENAI_API_KEY;
  if (envKey) return envKey;

  const s = await prisma.aiProviderSetting.findFirst({
    where: { organization_id: orgId, is_active: true },
  });
  const key =
    keyType === 'whisper'
      ? (s?.whisper_api_key_encrypted ?? s?.whatsapp_api_key_encrypted ?? s?.api_key_encrypted)
      : (s?.whatsapp_api_key_encrypted ?? s?.api_key_encrypted);
  if (!key) throw new Error(`No ${keyType} API key for org ${orgId}`);
  return key;
}

async function recordWhatsAppUpdate(
  msg: MetaMessage,
  phone: string,
  orgId: string | null,
  userId: string | null,
  status: string,
  rawText?: string,
  replySent?: string,
  pipelineOutput?: PipelineOutput
): Promise<void> {
  try {
    await prisma.whatsapp_updates.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        phone_number: phone,
        meta_message_id: msg.id,
        message_type: msg.type === 'audio' ? 'voice' : 'text',
        raw_message_text: rawText ?? msg.text?.body ?? null,
        status,
        reply_sent: replySent ?? null,
        reply_sent_at: replySent ? new Date() : null,
        // R4: Track M16 pipeline metadata
        ...(pipelineOutput ? {
          m16_intent: pipelineOutput.intent,
          m16_confidence: pipelineOutput.confidence,
          m16_tool_executed: pipelineOutput.toolExecuted,
          m16_tool_name: pipelineOutput.toolName,
        } : {}),
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[M16-R4] Failed to record whatsapp_update:', error?.message);
  }
}
