/**
 * PUT    /api/platform/notifications/rules/[id] — Update rule
 * DELETE /api/platform/notifications/rules/[id] — Delete rule
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationRuleService } from '@/core/notifications';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    const body = await req.json();
    const rule = await NotificationRuleService.update(id, {
      ...body,
      updated_by: (session?.user as any)?.id,
    });
    return NextResponse.json({ rule });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    await NotificationRuleService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
