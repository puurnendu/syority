import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ExecutionExcelAdapter } from '@/core/execution/ExecutionExcelAdapter';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('execution.bulk');
    if (error) return error;

    const orgId = session.user.organization_id;
    const userId = session.user.id;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const eventId = String(formData.get('event_id') || formData.get('eventId') || '');

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await ExecutionExcelAdapter.importExecutionUpdate(orgId, userId, buffer, eventId);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API BulkUploadAction] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
