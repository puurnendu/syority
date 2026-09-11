/**
 * LIVE Meta WhatsApp webhook (Next.js serves ./app over ./src/app).
 *
 * Transport: HMAC + rate-limit ACK.
 * Domain: WhatsAppChannelAdapter → M16InteractionPipeline → ConfirmationGate
 *         → writeTools → ExecutionWriteService.
 *
 * Legacy inbound processor and auto-apply progress are not used here.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  processWhatsAppWebhook,
  type MetaWebhookPayload,
} from '@/core/m16/channels/WhatsAppChannelAdapter';
import { verifyMetaWebhookSignature } from '@/core/m16/security/WebhookSignatureVerifier';
import { createGovernedPipelineDependencies } from '@/core/m16/pipeline/governedPipelineDeps';
import type { PipelineDependencies } from '@/core/m16/pipeline/M16InteractionPipeline';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not configured');
    return new Response('Webhook not configured', { status: 503 });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error('[WhatsApp Webhook] WHATSAPP_APP_SECRET is not configured');
    return new Response('OK', { status: 200 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    console.error('[WhatsApp Webhook] Failed to read request body');
    return new Response('OK', { status: 200 });
  }

  const signature = req.headers.get('x-hub-signature-256') ?? '';
  if (!signature) {
    console.warn('[WhatsApp Webhook] REJECTED: Missing X-Hub-Signature-256 header');
    return new Response('Unauthorized', { status: 401 });
  }

  const isValid = verifyMetaWebhookSignature(Buffer.from(rawBody, 'utf-8'), signature, appSecret);
  if (!isValid) {
    console.warn('[WhatsApp Webhook] REJECTED: Invalid X-Hub-Signature-256');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    console.error('[WhatsApp Webhook] Failed to parse JSON body');
    return new Response('OK', { status: 200 });
  }

  const deps: PipelineDependencies = createGovernedPipelineDependencies({
    organizationId: 'pending-identity',
    userId: 'pending-identity',
    channel: 'whatsapp',
    jobType: 'whatsapp_extraction',
  });

  void processWhatsAppWebhook({ rawBody, signature, payload }, appSecret, deps)
    .catch((err: unknown) => {
      console.error('[WhatsApp Webhook] Process error:', (err as Error)?.message);
    });

  return NextResponse.json({ status: 'received' }, { status: 200 });
}
