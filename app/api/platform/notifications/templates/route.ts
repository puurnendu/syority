/**
 * GET  /api/platform/notifications/templates — List templates
 * POST /api/platform/notifications/templates — Create template
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationTemplateService } from '@/core/notifications';

export async function GET(req: Request) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  const url = new URL(req.url);
  const category = url.searchParams.get('category') ?? undefined;
  const is_active = url.searchParams.get('is_active');

  try {
    const templates = await NotificationTemplateService.list({
      category,
      is_active: is_active !== null ? is_active === 'true' : undefined,
    });
    return NextResponse.json({ templates });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const body = await req.json();
    const template = await NotificationTemplateService.create({
      ...body,
      created_by: (session?.user as any)?.id,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
