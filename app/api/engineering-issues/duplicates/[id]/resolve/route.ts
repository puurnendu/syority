import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueDuplicateService } from '@/core/engineering-issues';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const body = await req.json();
  if (!body.resolution) return NextResponse.json({ error: 'resolution required' }, { status: 400 });

  const result = await IssueDuplicateService.resolveDuplicate(
    orgId, id, body.resolution, userId, body.notes
  );
  return NextResponse.json(result);
}
