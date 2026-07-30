/**
 * M7.6B — Saved Views API
 * GET: List saved views for the current user
 * POST: Create a saved view
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SavedViewService } from '@/core/report-engine';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const definitionId = searchParams.get('definitionId');

    const views = definitionId
      ? await SavedViewService.listForDefinition(definitionId, session.user.organizationId, session.user.id)
      : await SavedViewService.listForUser(session.user.organizationId, session.user.id);

    return NextResponse.json(views);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:build')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const view = await SavedViewService.create({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      definitionId: body.definitionId,
      name: body.name,
      description: body.description,
      parameters: body.parameters ?? {},
      selectedSections: body.selectedSections,
      outputFormat: body.outputFormat,
      layoutId: body.layoutId,
      includeAi: body.includeAi,
      isShared: body.isShared,
    });
    return NextResponse.json(view, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
