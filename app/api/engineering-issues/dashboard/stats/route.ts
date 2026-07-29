import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueSearchService } from '@/core/engineering-issues';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const stats = await IssueSearchService.getDashboardStats(orgId);
  return NextResponse.json(stats);
}
