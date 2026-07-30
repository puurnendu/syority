/**
 * POST /api/platform/notifications/providers/[id]/test-email — Send test email
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { sendTestEmail } from '@/core/notifications';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    const body = await req.json();
    if (!body.to) {
      return NextResponse.json({ error: 'Recipient email (to) is required' }, { status: 400 });
    }
    const result = await sendTestEmail(id, body.to);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
