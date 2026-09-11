import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';

// Stub: AiPrompt model does not exist in the current schema.
// Returns empty data until the model is added.

export const GET = withTenantGuard(async (_req, _ctx, session) => {
  return NextResponse.json({ data: [] });
});

export const PUT = withTenantGuard(async (req, _ctx, session) => {
  return NextResponse.json(
    { error: 'AI prompt configuration is not available in this release.' },
    { status: 501 }
  );
});
