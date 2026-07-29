import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { PlantImportService } from '@/core/digital-plant';
import type { ImportType } from '@/core/digital-plant/PlantImportService';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('project_id') as string;
  const importType = formData.get('import_type') as ImportType;

  if (!file || !projectId || !importType) {
    return NextResponse.json({ error: 'file, project_id, and import_type are required' }, { status: 400 });
  }

  try {
    const result = await PlantImportService.dryRunImport(orgId, projectId, file, importType);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import failed' }, { status: 500 });
  }
}
