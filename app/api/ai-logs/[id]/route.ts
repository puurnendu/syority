import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

// GET single log with full prompt + response text
export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const orgId = session.user.organization_id;
  const { id } = await params as { id: string };

  const log = await prisma.aiLog.findFirst({
    where: { id, organization_id: orgId },
  });

  if (!log) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data: log });
});
