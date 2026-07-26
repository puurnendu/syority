import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const config = await prisma.webhookConfig.findUnique({
      where: { organization_id: orgId },
      select: {
        id: true,
        url: true,
        is_active: true,
        events: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({ config });
  } catch (err: any) {
    console.error('[Webhooks GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch webhook config' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const body = await req.json();
    const { url, secret, is_active, events } = body;

    const data: any = {
      ...(url !== undefined && { url }),
      ...(secret !== undefined && { secret }),
      ...(is_active !== undefined && { is_active }),
      ...(events !== undefined && { events }),
      updated_at: new Date(),
    };

    const config = await prisma.webhookConfig.upsert({
      where: { organization_id: orgId },
      create: {
        id: uuidv4(),
        organization_id: orgId,
        url: url || '',
        secret: secret || null,
        is_active: is_active ?? true,
        events: events || [],
        updated_at: new Date(),
      },
      update: data,
    });

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    console.error('[Webhooks PATCH] Error:', err);
    return NextResponse.json({ error: 'Failed to update webhook config' }, { status: 500 });
  }
}
