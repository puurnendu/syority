import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/withTenantGuard';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  try {
    // We'll group constraints by Area and Severity.
    // Constraints are in `Constraint` model or `ConstraintLog`?
    // Based on PortfolioDashboard.tsx, it uses `ConstraintLog`.
    
    const logs = await prisma.constraintLog.findMany({
      where: {
        organization_id: orgId,
        status: { in: ['open', 'in_progress'] },
        deleted_at: null,
      },
      select: {
        severity: true,
        // Since we don't have a direct 'area' on ConstraintLog, 
        // we'll try to get it from the linked workpack or equipment if possible.
        // If not, we'll use 'discipline' as a proxy if it's available.
        workpack: {
          select: {
            site: { select: { name: true } }
          }
        }
      }
    });

    // Grouping logic
    const grouping: Record<string, any> = {};

    logs.forEach(log => {
      const area = log.workpack?.site?.name || 'General';
      if (!grouping[area]) {
        grouping[area] = { area, total: 0, critical: 0, high: 0, medium: 0, low: 0 };
      }
      grouping[area].total++;
      const sev = log.severity?.toLowerCase() || 'low';
      if (grouping[area][sev] !== undefined) {
        grouping[area][sev]++;
      }
    });

    return NextResponse.json(Object.values(grouping));
  } catch (err: any) {
    console.error('Constraint Heatmap Error:', err);
    return NextResponse.json({ error: 'Failed to fetch heatmap data' }, { status: 500 });
  }
});
