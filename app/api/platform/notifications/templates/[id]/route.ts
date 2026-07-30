/**
 * PUT    /api/platform/notifications/templates/[id] — Update template
 * DELETE /api/platform/notifications/templates/[id] — Delete template
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationTemplateService } from '@/core/notifications';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    const body = await req.json();
    const template = await NotificationTemplateService.update(id, {
      ...body,
      updated_by: (session?.user as any)?.id,
    });
    return NextResponse.json({ template });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    await NotificationTemplateService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
