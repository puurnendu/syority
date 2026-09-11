/**
 * POST /api/voice/process — Voice interaction endpoint
 * GET  /api/voice/process — Liveness (no secrets)
 *
 * Identity from NextAuth session, NEVER from voice content.
 * PipelineDependencies are the real governed factory (not stubs).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { processVoiceInteraction } from '@/core/m16/channels/VoiceChannelAdapter';
import { checkRateLimit } from '@/lib/rateLimiter';
import { createGovernedPipelineDependencies } from '@/core/m16/pipeline/governedPipelineDeps';

export async function GET() {
  return NextResponse.json({ status: 'ok', channel: 'voice' });
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.sub || !token?.organization_id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = token.sub as string;
    const organizationId = token.organization_id as string;
    const userName = (token.name as string) || 'Unknown';

    const rateResult = await checkRateLimit(`voice:${userId}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const eventId = formData.get('eventId') as string | null;
    const requestId = formData.get('requestId') as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided. Upload as "audio" field.' },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const whisperKey = process.env.WHATSAPP_OPENAI_API_KEY || '';

    const deps = createGovernedPipelineDependencies({
      organizationId,
      userId,
      channel: 'voice',
      jobType: 'whatsapp_extraction',
    });

    const result = await processVoiceInteraction(
      {
        audioBuffer,
        mimeType: audioFile.type || 'audio/webm',
        filename: audioFile.name || 'voice.webm',
        eventId: eventId || undefined,
        requestId: requestId || undefined,
      },
      { userId, userName, organizationId },
      whisperKey,
      deps
    );

    const statusCode = result.status === 'rejected' ? 403
      : result.status === 'error' ? 500
      : 200;

    return NextResponse.json(result, { status: statusCode });
  } catch (err: any) {
    console.error('[VoiceRoute] Unhandled error:', err.message);
    return NextResponse.json(
      { error: 'Voice processing failed. Please try again.' },
      { status: 500 }
    );
  }
}
