import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueBatchService } from '@/core/engineering-issues';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  const batch = await IssueBatchService.getBatch(orgId, id);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(batch);
}
