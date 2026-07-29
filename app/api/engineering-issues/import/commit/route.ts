import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueImportService } from '@/core/engineering-issues';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const batchName = (formData.get('batch_name') as string) || file.name;
  const sourceType = (formData.get('source_type') as string) || 'excel';
  const sourceDepartment = formData.get('source_department') as string | undefined;
  const siteId = formData.get('site_id') as string | undefined;
  const columnMapping = formData.get('column_mapping')
    ? JSON.parse(formData.get('column_mapping') as string)
    : {};

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await IssueImportService.commitImport({
    organizationId: orgId,
    siteId,
    batchName,
    sourceType: sourceType as any,
    sourceFilename: file.name,
    sourceDepartment,
    userId,
    columnMapping,
    fileBuffer: buffer,
  });

  return NextResponse.json(result, { status: 201 });
}
