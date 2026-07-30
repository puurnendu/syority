/**
 * GET /api/platform/notifications/delivery-logs — Paginated delivery logs
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { listDeliveryLogs } from '@/core/notifications';

export async function GET(req: Request) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const event_type = url.searchParams.get('event_type') ?? undefined;
  const recipient_email = url.searchParams.get('recipient_email') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  try {
    const result = await listDeliveryLogs({ status, limit, offset, event_type, recipient_email });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
