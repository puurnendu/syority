import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { isLegacyProjectChainEnabled, LEGACY_PROJECT_CHAIN_RETIRED } from '@/lib/legacyProjectChain';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  // Phase 0 item 5: legacy punch register (punch_items) is quarantined.
  // The live STO register is PunchListItem (Event/Workpack-scoped).
  if (!(await isLegacyProjectChainEnabled(orgId))) {
    return NextResponse.json(LEGACY_PROJECT_CHAIN_RETIRED, { status: 410 });
  }
  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [byCategoryOpen, byCategoryClosed, items] = await Promise.all([
    prisma.punch_items.groupBy({
      by: ['category'],
      where: { project_id: projectId, status: 'Open' },
      _count: { _all: true },
    }),
    prisma.punch_items.groupBy({
      by: ['category'],
      where: { project_id: projectId, status: 'Closed' },
      _count: { _all: true },
    }),
    prisma.punch_items.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      take: 200,
    }),
  ]);

  const getCount = (arr: { category: string; _count: { _all: number } }[], cat: string) =>
    arr.find((x) => x.category === cat)?._count._all ?? 0;

  const summary = {
    A_open: getCount(byCategoryOpen, 'A'),
    A_closed: getCount(byCategoryClosed, 'A'),
    B_open: getCount(byCategoryOpen, 'B'),
    B_closed: getCount(byCategoryClosed, 'B'),
    C_open: getCount(byCategoryOpen, 'C'),
    C_closed: getCount(byCategoryClosed, 'C'),
  };

  return NextResponse.json({
    summary,
    items: items.map((i) => ({
      id: i.id,
      punch_number: i.punch_number,
      punchNumber: i.punch_number,
      category: i.category,
      description: i.description,
      discipline: i.discipline,
      location: i.location,
      assigned_to: i.assigned_to,
      assignedTo: i.assigned_to,
      status: i.status,
      due_date: i.due_date,
      dueDate: i.due_date,
    })),
  });
});
