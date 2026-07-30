/**
 * M7.6B — Popular Reports API
 * GET: Most-used report definitions and most-active schedules
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Most-used report definitions (last 30 days)
    const topDefinitions = await prisma.report_generations.groupBy({
      by: ['definition_id'],
      where: { organization_id: orgId, created_at: { gte: thirtyDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Enrich with definition names
    const defIds = topDefinitions.map((d) => d.definition_id);
    const definitions = await prisma.report_definitions.findMany({
      where: { id: { in: defIds } },
      select: { id: true, name: true, slug: true, category: { select: { name: true } } },
    });
    const defMap = new Map(definitions.map((d) => [d.id, d]));

    const popularReports = topDefinitions.map((td) => ({
      definitionId: td.definition_id,
      name: defMap.get(td.definition_id)?.name ?? 'Unknown',
      category: defMap.get(td.definition_id)?.category.name ?? '—',
      count: td._count.id,
    }));

    // Most-active schedules
    const topSchedules = await prisma.report_schedules.findMany({
      where: { organization_id: orgId, is_active: true },
      select: { id: true, name: true, frequency: true, run_count: true, last_run_at: true, definition: { select: { name: true } } },
      orderBy: { run_count: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      popularReports,
      topSchedules: topSchedules.map((s) => ({
        id: s.id,
        name: s.name,
        frequency: s.frequency,
        runCount: s.run_count,
        lastRun: s.last_run_at,
        definitionName: s.definition.name,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
