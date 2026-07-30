/**
 * PUT    /api/platform/notifications/providers/[id] — Update provider
 * DELETE /api/platform/notifications/providers/[id] — Delete provider
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationProviderService } from '@/core/notifications';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    const body = await req.json();
    const provider = await NotificationProviderService.update(id, {
      ...body,
      updated_by: (session?.user as any)?.id,
    });
    return NextResponse.json({ provider });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    await NotificationProviderService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
