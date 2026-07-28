import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('settings.templates.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const body = await req.json().catch(() => ({}));
  if (!body.a || !body.b) {
    return NextResponse.json({ error: 'a and b template ids required' }, { status: 400 });
  }
  try {
    const diff = await TemplateLibraryService.compare(body.a, body.b, orgId);
    return NextResponse.json(diff);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Compare failed' },
      { status: 400 }
    );
  }
}
