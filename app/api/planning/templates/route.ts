import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('settings.templates.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const sp = req.nextUrl.searchParams;

  const items = await TemplateLibraryService.list({
    organizationId: orgId,
    library: (sp.get('library') as any) || 'ALL',
    status: (sp.get('status') as any) || 'ALL',
    q: sp.get('q') || undefined,
    latestOnly: sp.get('latest') !== '0',
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('settings.templates.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const userId = (session!.user as any).id;
  const body = await req.json();

  if (!body?.name?.trim() || !body?.equipment_type?.trim() || !body?.job_type?.trim()) {
    return NextResponse.json(
      { error: 'name, equipment_type, and job_type are required' },
      { status: 400 }
    );
  }

  try {
    const created = await TemplateLibraryService.createDraft({
      organizationId: orgId,
      userId,
      library_scope: body.library_scope || 'TENANT',
      name: body.name.trim(),
      equipment_type: body.equipment_type.trim(),
      job_type: body.job_type.trim(),
      category: body.category,
      equipment_class: body.equipment_class,
      discipline_id: body.discipline_id,
      description: body.description,
      sections: body,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Create failed' },
      { status: 400 }
    );
  }
}
