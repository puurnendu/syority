import { NextRequest } from 'next/server';
import { processInboundMessage } from '@/services/whatsapp/MessageProcessor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  console.log('[WhatsApp Webhook] Verification Request:', { mode });

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not configured');
    return new Response('Webhook not configured', { status: 503 });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification SUCCESS');
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[WhatsApp Webhook] Verification FAILED: Invalid token');
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
    console.log('[WhatsApp Webhook] Incoming Message:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('[WhatsApp Webhook] Failed to parse JSON body');
    return new Response('OK', { status: 200 });
  }

  void processInboundMessage(body).catch((err: unknown) => {
    console.error('[WhatsApp Webhook] Process error:', err);
  });

  return new Response('OK', { status: 200 });
}
