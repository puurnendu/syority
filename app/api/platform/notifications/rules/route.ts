/**
 * GET  /api/platform/notifications/rules — List rules
 * POST /api/platform/notifications/rules — Create rule
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationRuleService } from '@/core/notifications';

export async function GET(req: Request) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  const url = new URL(req.url);
  const event_type = url.searchParams.get('event_type') ?? undefined;

  try {
    const rules = await NotificationRuleService.list({ event_type });
    return NextResponse.json({ rules });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const body = await req.json();
    const rule = await NotificationRuleService.create({
      ...body,
      created_by: (session?.user as any)?.id,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
