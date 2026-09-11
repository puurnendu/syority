import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackFactoryService } from '@/core/workpack-factory';

/**
 * M9 — Factory Preview API.
 *
 * POST /api/workpack-factory/preview
 *
 * Shows what a workpack would contain before creation.
 * Does NOT create any records.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const body = await req.json();

  if (!body.scope_item_id) {
    return NextResponse.json({ error: 'scope_item_id is required' }, { status: 400 });
  }
  if (!body.template_id) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
  }

  try {
    const preview = await WorkpackFactoryService.preview(
      orgId,
      body.scope_item_id,
      body.template_id
    );
    return NextResponse.json({ data: preview });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
