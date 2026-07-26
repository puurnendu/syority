import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { appUrl } from '@/lib/appUrl';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Generating notification digests...');

  try {
    // 1. Find all users who have unread notifications
    // We group by user_id
    const unreadNotifications = await prisma.notification.findMany({
      where: { is_read: false },
      orderBy: { created_at: 'desc' },
      include: {
        Organization: { select: { name: true } },
      },
    });

    if (unreadNotifications.length === 0) {
      return NextResponse.json({ ok: true, message: 'No unread notifications to digest.' });
    }

    // Group by user_id
    const userMap = new Map<string, typeof unreadNotifications>();
    for (const notif of unreadNotifications) {
      const list = userMap.get(notif.user_id) || [];
      list.push(notif);
      userMap.set(notif.user_id, list);
    }

    // Fetch user details
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userMap.keys()) } },
      select: { id: true, name: true, email: true },
    });

    let sentCount = 0;

    for (const user of users) {
      if (!user.email) continue;
      
      const notifs = userMap.get(user.id);
      if (!notifs || notifs.length === 0) continue;

      const orgName = notifs[0].Organization?.name || 'Syority';
      const dashboardHref = appUrl('/dashboard', req);

      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4f46e5;">Daily Notification Digest</h2>
          <p>Hello ${user.name || 'User'},</p>
          <p>You have <strong>${notifs.length}</strong> unread notifications in ${orgName}. Here are the latest updates:</p>
          
          <ul style="list-style: none; padding: 0;">
            ${notifs.slice(0, 10).map(n => `
              <li style="margin-bottom: 15px; padding: 10px; border-left: 4px solid #e5e7eb; background: #f9fafb;">
                <strong>${n.title}</strong>
                ${n.message ? `<p style="margin: 5px 0 0; color: #666; font-size: 14px;">${n.message}</p>` : ''}
                <div style="margin-top: 5px; font-size: 12px; color: #999;">
                  ${new Date(n.created_at).toLocaleString('en-GB')}
                </div>
              </li>
            `).join('')}
          </ul>
          
          ${notifs.length > 10 ? `<p style="color: #666; font-size: 14px;">...and ${notifs.length - 10} more.</p>` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <a href="${dashboardHref}" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Syority Notifications" <${process.env.SMTP_USER || 'noreply@syority.com'}>`,
        to: user.email,
        subject: `[Syority] You have ${notifs.length} unread notifications`,
        html: htmlBody,
      });

      sentCount++;
    }

    return NextResponse.json({
      ok: true,
      usersProcessed: sentCount,
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Cron] Digest error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
