import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { PlantImportService } from '@/core/digital-plant';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!body.batch_id) return NextResponse.json({ error: 'batch_id is required' }, { status: 400 });

  try {
    const result = await PlantImportService.rollbackImport(orgId, body.batch_id, userId);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Rollback failed' }, { status: 400 });
  }
}
