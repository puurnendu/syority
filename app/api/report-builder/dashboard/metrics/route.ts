/**
 * M7.6B — Report Engine Dashboard Metrics API
 * GET: Aggregated execution metrics for reporting dashboard
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const orgId = session.user.organizationId;
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(weekStart.getDate() - 30);

    // Aggregate metrics
    const [
      todayCount, weekCount, monthCount,
      todayFailed, weekFailed,
      avgDuration,
      pendingQueue,
      activeSchedules,
    ] = await Promise.all([
      prisma.report_generations.count({ where: { organization_id: orgId, created_at: { gte: todayStart } } }),
      prisma.report_generations.count({ where: { organization_id: orgId, created_at: { gte: weekStart } } }),
      prisma.report_generations.count({ where: { organization_id: orgId, created_at: { gte: monthStart } } }),
      prisma.report_generations.count({ where: { organization_id: orgId, status: 'failed', created_at: { gte: todayStart } } }),
      prisma.report_generations.count({ where: { organization_id: orgId, status: 'failed', created_at: { gte: weekStart } } }),
      prisma.report_generations.aggregate({
        where: { organization_id: orgId, status: 'completed', created_at: { gte: weekStart } },
        _avg: { duration_ms: true },
      }),
      prisma.notification_queue.count({ where: { organization_id: orgId, status: 'pending', event_type: { startsWith: 'report.' } } }),
      prisma.report_schedules.count({ where: { organization_id: orgId, is_active: true } }),
    ]);

    return NextResponse.json({
      metrics: {
        today: { generated: todayCount, failed: todayFailed },
        week: { generated: weekCount, failed: weekFailed },
        month: { generated: monthCount },
        avgDurationMs: Math.round(avgDuration._avg.duration_ms ?? 0),
        pendingQueue,
        activeSchedules,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
