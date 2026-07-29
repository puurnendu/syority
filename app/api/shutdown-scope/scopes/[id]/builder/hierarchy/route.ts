import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeBuilderService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const tree = await ScopeBuilderService.getHierarchyTree(orgId, id);
  return NextResponse.json(tree);
}
