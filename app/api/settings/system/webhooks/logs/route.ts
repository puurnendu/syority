import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const logs = await prisma.webhookLog.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        event: true,
        status_code: true,
        response: true,
        created_at: true,
      },
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error('[Webhooks Logs GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch webhook logs' }, { status: 500 });
  }
}
