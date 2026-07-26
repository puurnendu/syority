import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

// GET — fetch AI logs with optional filters
export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const orgId = session.user.organization_id;
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));
  const jobType = searchParams.get('job_type') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const skip = (page - 1) * limit;

  const where = {
    organization_id: orgId,
    ...(jobType ? { job_type: jobType } : {}),
    ...(status ? { status } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.aiLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        user_id: true,
        job_type: true,
        provider: true,
        model: true,
        tokens_input: true,
        tokens_output: true,
        latency_ms: true,
        status: true,
        error_message: true,
        created_at: true,
        // prompt/response omitted from list for performance
      },
    }),
    prisma.aiLog.count({ where }),
  ]);

  return NextResponse.json({
    data: logs,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// GET single log with full prompt/response — /api/ai-logs/[id]
// This route handles the list; detail is handled by /api/ai-logs/[id]/route.ts
