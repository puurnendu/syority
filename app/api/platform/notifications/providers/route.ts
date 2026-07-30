/**
 * GET  /api/platform/notifications/providers — List all providers
 * POST /api/platform/notifications/providers — Create a new provider
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationProviderService } from '@/core/notifications';

export async function GET() {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const providers = await NotificationProviderService.list();
    return NextResponse.json({ providers });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const body = await req.json();
    const provider = await NotificationProviderService.create({
      ...body,
      created_by: (session?.user as any)?.id,
    });
    return NextResponse.json({ provider }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
