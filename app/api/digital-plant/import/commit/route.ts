import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { PlantImportService } from '@/core/digital-plant';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  const { project_id, dry_run_result, document_id } = body;

  if (!project_id || !dry_run_result || !document_id) {
    return NextResponse.json({ error: 'project_id, document_id, and dry_run_result are required' }, { status: 400 });
  }

  try {
    const result = await PlantImportService.commitImport(orgId, project_id, dry_run_result, document_id, userId);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Commit failed' }, { status: 500 });
  }
}
