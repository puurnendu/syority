import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueImportService } from '@/core/engineering-issues';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  orgScope(session!);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const existingMapping = formData.get('column_mapping')
    ? JSON.parse(formData.get('column_mapping') as string)
    : undefined;

  const result = await IssueImportService.dryRunImport(buffer, file.name, existingMapping);
  return NextResponse.json(result);
}
