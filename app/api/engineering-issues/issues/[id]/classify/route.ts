import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueClassificationService } from '@/core/engineering-issues';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  const result = await IssueClassificationService.classifySingleIssue(orgId, id);
  return NextResponse.json(result);
}
