import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueImportService } from '@/core/engineering-issues';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const result = await IssueImportService.aiExtractIssues(
    orgId,
    body.text,
    body.source_type || 'pdf',
    userId,
    body.batch_name,
    body.department,
    body.site_id
  );

  return NextResponse.json(result, { status: 201 });
}
