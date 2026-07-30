/**
 * POST /api/platform/notifications/templates/[id]/preview — Preview template with sample data
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { NotificationTemplateService } from '@/core/notifications';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const preview = await NotificationTemplateService.preview(id, body.variables);
    return NextResponse.json(preview);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
