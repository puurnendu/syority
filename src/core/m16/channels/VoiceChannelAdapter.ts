/**
 * M16-R5 — VoiceChannelAdapter
 *
 * Voice is a CHANNEL ADAPTER.
 * It uses the SAME M16 Interaction Pipeline as Web and WhatsApp.
 *
 * FLOW:
 *   Audio Buffer (authenticated web/mobile session)
 *     → Audio validation (size, format)
 *     → TranscriptionService (Whisper)
 *     → Confidence check (reject if too low)
 *     → resolveWebIdentity(session) — identity from auth, NOT voice
 *     → resolveEventContext(orgId)
 *     → buildInteractionContext()
 *     → resolve user role (organizationMembership)
 *     → processInteraction() — SAME PIPELINE
 *     → Response (text)
 *
 * DOES NOT:
 *   - Establish identity from voice content
 *   - Calculate progress, CPM, readiness
 *   - Access Prisma for domain mutations
 *   - Create alternate authorization/confirmation/risk
 *   - Bypass ConfirmationGate
 *
 * SECURITY:
 *   - Identity from NextAuth session (trusted)
 *   - Event from EventContextResolver (trusted)
 *   - Transcript treated as untrusted user input
 *   - Low confidence → clarification, never guess
 */

import { transcribe, TranscriptionValidationError, TranscriptionProviderError } from '@/services/ai/TranscriptionService';
import { resolveWebIdentity } from '../security/IdentityResolver';
import { resolveEventContext } from '../context/EventContextResolver';
import { buildInteractionContext } from '../context/InteractionContextBuilder';
import { processInteraction } from '../pipeline/M16InteractionPipeline';
import { detectInjectionPatterns } from '../security/PromptInjectionBoundary';
import { prisma } from '@/lib/prisma';
import type { PipelineDependencies } from '../pipeline/M16InteractionPipeline';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VoiceSession {
  userId: string;
  userName: string;
  organizationId: string;
  email?: string;
}

export interface VoiceRequest {
  audioBuffer: Buffer | ArrayBuffer;
  mimeType: string;
  filename?: string;
  eventId?: string;
  /** Unique request ID for idempotency */
  requestId?: string;
}

export interface VoiceResult {
  status: 'processed' | 'rejected' | 'clarification_needed' | 'error';
  transcript?: string;
  response?: string;
  reason?: string;
  intent?: string;
  confidence?: number;
  pendingConfirmation?: boolean;
  transcriptionConfidence?: number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Below this confidence, ask for clarification instead of processing */
const MIN_TRANSCRIPTION_CONFIDENCE = 0.4;

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Process a voice interaction through the M16 pipeline.
 *
 * Identity comes from the authenticated session, NOT from the voice content.
 */
export async function processVoiceInteraction(
  request: VoiceRequest,
  session: VoiceSession,
  whisperKey: string,
  deps: PipelineDependencies
): Promise<VoiceResult> {
  // ── 0. Validate session ────────────────────────────────────────────────────
  if (!session.userId || !session.organizationId) {
    return {
      status: 'rejected',
      reason: 'Authentication required. Please log in.',
    };
  }

  // ── 1. Transcribe ──────────────────────────────────────────────────────────
  let transcript: string;
  let transcriptionConfidence: number | null = null;
  let detectedLanguage = 'en';

  try {
    if (!whisperKey) {
      return {
        status: 'rejected',
        reason: 'Voice transcription is not configured for this organization.',
      };
    }

    const result = await transcribe(
      {
        audioBuffer: request.audioBuffer,
        mimeType: request.mimeType,
        filename: request.filename,
      },
      { apiKey: whisperKey }
    );

    transcript = result.transcript;
    transcriptionConfidence = result.confidence;
    detectedLanguage = result.detectedLanguage;
  } catch (err: any) {
    if (err instanceof TranscriptionValidationError) {
      return { status: 'rejected', reason: err.message };
    }
    if (err instanceof TranscriptionProviderError) {
      return { status: 'error', reason: 'Voice transcription temporarily unavailable. Please try again.' };
    }
    return { status: 'error', reason: 'Voice processing failed. Please try again.' };
  }

  // ── 2. Empty transcript check ──────────────────────────────────────────────
  if (!transcript || transcript.trim().length === 0) {
    return {
      status: 'clarification_needed',
      reason: 'I could not hear anything. Please try again.',
      transcriptionConfidence,
    };
  }

  // ── 3. Confidence check ────────────────────────────────────────────────────
  if (transcriptionConfidence !== null && transcriptionConfidence < MIN_TRANSCRIPTION_CONFIDENCE) {
    return {
      status: 'clarification_needed',
      transcript,
      reason: `I'm not sure I understood correctly. Did you say: "${transcript}"? Please confirm or try again.`,
      transcriptionConfidence,
    };
  }

  // ── 4. Identity from trusted session (NOT from transcript) ─────────────────
  const identity = resolveWebIdentity({
    user: {
      id: session.userId,
      name: session.userName,
      organization_id: session.organizationId,
    },
  });

  // ── 5. Event context ───────────────────────────────────────────────────────
  const eventContext = await resolveEventContext(
    session.organizationId,
    'voice',
    request.eventId ?? null,
    null // no WhatsApp session
  );

  if (eventContext.resolution === 'NONE') {
    return {
      status: 'rejected',
      transcript,
      reason: 'No active events found for your organization.',
    };
  }

  if (eventContext.resolution === 'AMBIGUOUS') {
    const eventList = eventContext.candidates
      ?.map((c: any) => `• ${c.code} — ${c.name}`)
      .join('\n') || '';
    return {
      status: 'clarification_needed',
      transcript,
      reason: `Multiple active events found. Please specify which event:\n${eventList}`,
    };
  }

  // ── 5b. Prompt injection boundary (transcript is untrusted) ────────────────
  const injectionHits = detectInjectionPatterns(transcript);
  const blockingInjection = injectionHits.some((h) =>
    ['ROLE_ESCALATION', 'AUTH_BYPASS', 'TENANT_OVERRIDE', 'TENANT_SWITCH', 'CONTEXT_OVERRIDE', 'EVENT_OVERRIDE'].includes(h)
  );
  if (blockingInjection) {
    return {
      status: 'rejected',
      transcript,
      reason: 'Voice command rejected: untrusted instruction override detected.',
    };
  }

  // ── 6. Build M16 context ───────────────────────────────────────────────────
  const conversationId = `voice-${session.userId}-${eventContext.eventId}`;
  const context = buildInteractionContext({
    identity,
    channel: 'voice',
    conversationId,
    eventId: eventContext.eventId!,
    identitySource: 'session_cookie',
    siteId: eventContext.siteId,
    messageId: request.requestId ?? null,
  });

  // ── 7. Resolve user role ───────────────────────────────────────────────────
  let userRole: string | null = null;
  try {
    const membership = await prisma.organizationMembership.findFirst({
      where: { user_id: session.userId, organization_id: session.organizationId },
      select: { role: true },
    });
    userRole = membership?.role ?? null;
  } catch {
    // fail-closed: null role → authorization will deny writes
  }

  // ── 8. Process through M16 pipeline ────────────────────────────────────────
  try {
    const pipelineResult = await processInteraction(
      {
        text: transcript,
        context,
        // OD9.2 §20: see WhatsAppChannelAdapter — an ORGANIZATION id was being passed
        // through the Project-named `projectId` field, which the pipeline never reads.
        userRole,
      },
      deps
    );

    return {
      status: 'processed',
      transcript,
      response: pipelineResult.response?.text || 'Processed.',
      intent: pipelineResult.intent,
      confidence: pipelineResult.confidence,
      pendingConfirmation: pipelineResult.pendingConfirmation || false,
      transcriptionConfidence,
    };
  } catch (err: any) {
    console.error('[VoiceChannelAdapter] Pipeline error:', err.message);
    return {
      status: 'error',
      transcript,
      reason: 'Unable to process your request. Please try again.',
    };
  }
}
