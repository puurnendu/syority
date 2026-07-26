import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') !== 'false';

    const notifications = await prisma.notification.findMany({
      where: {
        organization_id: orgId,
        user_id: userId,
        ...(unreadOnly ? { is_read: false } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const mapped = notifications.map((n) => ({
      ...n,
      body: n.message || '',
      link: n.action_url || null,
    }));

    const unread_count = notifications.filter((n) => !n.is_read).length;

    return NextResponse.json({ notifications: mapped, unread_count });
  } catch (error: any) {
    console.error('[Notifications GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
});

export const PATCH = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { id, markAllRead } = body;

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { organization_id: orgId, user_id: userId, is_read: false },
        data: { is_read: true, read_at: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (id) {
      await prisma.notification.updateMany({
        where: { id, organization_id: orgId, user_id: userId },
        data: { is_read: true, read_at: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('[Notifications PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
});
