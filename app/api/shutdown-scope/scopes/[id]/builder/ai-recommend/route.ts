import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeAiService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const result = await ScopeAiService.recommendScope(orgId, id);
  return NextResponse.json(result);
}
