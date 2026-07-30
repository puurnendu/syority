/**
 * GET  /api/platform/notifications/groups — List groups
 * POST /api/platform/notifications/groups — Create group
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationRecipientGroupService } from '@/core/notifications';

export async function GET() {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const groups = await NotificationRecipientGroupService.list();
    return NextResponse.json({ groups });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const body = await req.json();
    const group = await NotificationRecipientGroupService.create({
      ...body,
      created_by: (session?.user as any)?.id,
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
