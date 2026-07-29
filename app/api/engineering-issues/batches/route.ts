import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueBatchService } from '@/core/engineering-issues';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const result = await IssueBatchService.listBatches({
    organizationId: orgId,
    sourceType: (searchParams.get('source_type') as any) ?? undefined,
    sourceDepartment: searchParams.get('source_department') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '25', 10),
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!body.name || !body.source_type) {
    return NextResponse.json({ error: 'name and source_type are required' }, { status: 400 });
  }

  const batch = await IssueBatchService.createBatch({
    organizationId: orgId,
    siteId: body.site_id,
    name: body.name,
    description: body.description,
    sourceType: body.source_type,
    sourceFilename: body.source_filename,
    sourceDepartment: body.source_department,
    uploadedBy: userId,
  });

  return NextResponse.json(batch, { status: 201 });
}
