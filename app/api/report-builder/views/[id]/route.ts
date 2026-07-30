/**
 * M7.6B — Saved View Detail API
 * GET: Get a saved view
 * PUT: Update a saved view
 * DELETE: Delete a saved view
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SavedViewService } from '@/core/report-engine';
import { hasPermission } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const view = await SavedViewService.getById(params.id);
    return NextResponse.json(view);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message.includes('not found') ? 404 : 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:build')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const updated = await SavedViewService.update(params.id, body, session.user.id);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message.includes('owner') ? 403 : 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:build')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await SavedViewService.delete(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message.includes('owner') ? 403 : 500 });
  }
}
