import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  // Aggregate items by discipline
  const byDiscipline = await prisma.scopeItem.groupBy({
    by: ['discipline'],
    where: { scope_id: id, organization_id: orgId, deleted_at: null },
    _count: true,
    _sum: { estimated_hours: true },
  });

  // Aggregate by requested_by (department)
  const byDepartment = await prisma.scopeItem.groupBy({
    by: ['requested_by'],
    where: { scope_id: id, organization_id: orgId, deleted_at: null },
    _count: true,
    _sum: { estimated_hours: true },
  });

  // Aggregate by priority
  const byPriority = await prisma.scopeItem.groupBy({
    by: ['priority'],
    where: { scope_id: id, organization_id: orgId, deleted_at: null },
    _count: true,
    _sum: { estimated_hours: true },
  });

  return NextResponse.json({
    report: 'department_summary',
    by_discipline: byDiscipline.map((d) => ({
      discipline: d.discipline || 'Unassigned',
      count: d._count,
      estimated_hours: d._sum.estimated_hours || 0,
    })),
    by_department: byDepartment.map((d) => ({
      department: d.requested_by || 'Unassigned',
      count: d._count,
      estimated_hours: d._sum.estimated_hours || 0,
    })),
    by_priority: byPriority.map((p) => ({
      priority: p.priority,
      count: p._count,
      estimated_hours: p._sum.estimated_hours || 0,
    })),
  });
}
