/**
 * M14-R5 — Saved View Duplicate Endpoint
 * POST: Clone an existing saved view template with tenant isolation
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SavedViewService } from '@/core/report-engine';
import { hasPermission } from '@/lib/permissions';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:build')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const duplicated = await SavedViewService.duplicate(id, session.user.id, body.name);
    return NextResponse.json(duplicated, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
