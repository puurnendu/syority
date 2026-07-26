import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;
  const eventId = req.nextUrl.searchParams.get('event_id') ?? undefined;
  const format = req.nextUrl.searchParams.get('format') ?? 'csv';

  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const where: { organization_id: string; system_id: string; event_id?: string } = {
    organization_id: orgId,
    system_id: systemId,
  };
  if (eventId) where.event_id = eventId;

  const nodes = await prisma.wbsNode.findMany({
    where,
    orderBy: [{ order: 'asc' }, { code: 'asc' }],
    include: { parent: { select: { code: true } } },
  });

  function level(c: string | null): number {
    if (!c) return 0;
    return (c.match(/\./g)?.length ?? 0) + 1;
  }

  if (format === 'csv') {
    const header = 'WBS Code,Name,Type,Parent Code,Level\n';
    const rows = nodes.map(
      (n) =>
        `${escapeCsv(n.code)},${escapeCsv(n.name)},${n.type},${escapeCsv(n.parent?.code ?? '')},${level(n.parent_id ?? null)}`
    );
    const csv = header + rows.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="wbs-${systemId}.csv"`,
      },
    });
  }

  const text = nodes.map((n) => `${'  '.repeat(level(n.parent_id ?? null))}${n.code} ${n.name} [${n.type}]`).join('\n');
  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="wbs-${systemId}.txt"`,
    },
  });
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
