/**
 * GET  /api/platform/notifications/queue — List queue items
 * POST /api/platform/notifications/queue — Process queue (trigger processing)
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { listQueueItems, processQueue, getQueueStats } from '@/core/notifications';

export async function GET(req: Request) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  try {
    const [result, stats] = await Promise.all([
      listQueueItems({ status, limit, offset }),
      getQueueStats(),
    ]);
    return NextResponse.json({ ...result, stats });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST() {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const processed = await processQueue(50);
    return NextResponse.json({ processed });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
