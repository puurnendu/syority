import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueService } from '@/core/engineering-issues';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const result = await IssueService.listIssues({
    organizationId: orgId,
    siteId: searchParams.get('site_id') ?? undefined,
    batchId: searchParams.get('batch_id') ?? undefined,
    assetId: searchParams.get('asset_id') ?? undefined,
    status: (searchParams.get('status') as any) ?? undefined,
    department: searchParams.get('department') ?? undefined,
    discipline: searchParams.get('discipline') ?? undefined,
    priority: (searchParams.get('priority') as any) ?? undefined,
    equipmentTag: searchParams.get('equipment_tag') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '50', 10),
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!body.problem?.trim()) {
    return NextResponse.json({ error: 'problem is required' }, { status: 400 });
  }

  const issue = await IssueService.createIssue({
    organizationId: orgId,
    siteId: body.site_id,
    batchId: body.batch_id,
    issueNumber: body.issue_number,
    equipmentTagRaw: body.equipment_tag,
    equipmentDescRaw: body.equipment_description,
    department: body.department,
    problem: body.problem,
    recommendation: body.recommendation,
    priority: body.priority,
    severity: body.severity,
    targetTa: body.target_ta,
    originator: body.originator,
    raisedDate: body.raised_date,
    dueDate: body.due_date,
    comments: body.comments,
    createdBy: userId,
  });

  return NextResponse.json(issue, { status: 201 });
}
