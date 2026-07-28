import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('settings.templates.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const tpl = await TemplateLibraryService.get(id, orgId);
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tpl);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('settings.templates.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const userId = (session!.user as any).id;
  const { id } = await params;
  const body = await req.json();
  try {
    const updated = await TemplateLibraryService.updateDraft(id, orgId, userId, body);
    return NextResponse.json(updated);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Update failed' },
      { status: 400 }
    );
  }
}
