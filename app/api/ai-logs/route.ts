import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';

// GET — fetch AI logs with optional filters
// NOTE: The AiLog model does not exist in the current Prisma schema.
// This route returns an empty set until the model is created.
export const GET = withTenantGuard(async (req: NextRequest, _ctx, _session) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));

  return NextResponse.json({
    data: [],
    meta: { total: 0, page, limit, pages: 0 },
    _note: 'AiLog model is not yet available in the schema',
  });
});
