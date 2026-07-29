import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueDuplicateService } from '@/core/engineering-issues';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const resolved = searchParams.get('resolved');
  const items = await IssueDuplicateService.listDuplicates(
    orgId,
    resolved === 'true' ? true : resolved === 'false' ? false : undefined
  );
  return NextResponse.json({ data: items, total: items.length });
}
