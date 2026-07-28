import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('settings.templates.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const userId = (session!.user as any).id;
  const { id } = await params;
  try {
    const updated = await TemplateLibraryService.publish(id, orgId, userId);
    return NextResponse.json(updated);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Publish failed' },
      { status: 400 }
    );
  }
}
