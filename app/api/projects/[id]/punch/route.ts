import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [byCategoryOpen, byCategoryClosed, items] = await Promise.all([
    prisma.punchItem.groupBy({
      by: ['category'],
      where: { projectId, status: 'Open' },
      _count: { _all: true },
    }),
    prisma.punchItem.groupBy({
      by: ['category'],
      where: { projectId, status: 'Closed' },
      _count: { _all: true },
    }),
    prisma.punchItem.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
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
      punch_number: i.punchNumber,
      punchNumber: i.punchNumber,
      category: i.category,
      description: i.description,
      discipline: i.discipline,
      location: i.location,
      assigned_to: i.assignedTo,
      assignedTo: i.assignedTo,
      status: i.status,
      due_date: i.dueDate,
      dueDate: i.dueDate,
    })),
  });
});
