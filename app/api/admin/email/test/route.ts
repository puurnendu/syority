import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import {
    verifyEmailConnection,
    sendEmailWithRetry,
} from '@/lib/email/emailService';

export async function POST(req: Request) {
    const { session, error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const testTo =
        body.to ?? (session!.user as { email?: string })?.email;

    if (!testTo) {
        return NextResponse.json(
            { success: false, error: 'No recipient. Provide body.to or ensure session has email.' },
            { status: 400 }
        );
    }

    const connectionCheck = await verifyEmailConnection().catch((e: Error) => ({
        ok: false as const,
        error: e.message,
    }));

    if (!connectionCheck.ok) {
        return NextResponse.json(
            {
                success: false,
                step: 'connection',
                error: connectionCheck.error,
                hint:
                    'Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file',
            },
            { status: 503 }
        );
    }

    const result = await sendEmailWithRetry({
        to: testTo,
        subject: '✅ AURIANOA OS — Email Test',
        html: `
        <div style="font-family:Arial;padding:32px;max-width:480px;margin:0 auto;">
          <h2 style="color:#0D2137;">Email Test Successful</h2>
          <p style="color:#6B7280;">This test email confirms your SMTP configuration is working correctly.</p>
          <div style="background:#F0FDF4;border:1px solid #A7F3D0;border-radius:8px;padding:16px;margin-top:20px;">
            <p style="margin:0;color:#065F46;font-size:13px;">
              ✅ Connection: OK<br>✅ Authentication: OK<br>✅ Sending: OK<br>
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json(
        {
            success: result.success,
            messageId: result.messageId,
            sentTo: testTo,
            connectionCheck: 'ok',
            error: result.error,
        },
        { status: result.success ? 200 : 500 }
    );
}
