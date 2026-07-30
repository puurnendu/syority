/**
 * M7.6B — Branding Profile Detail API
 * GET: Get a branding profile by ID
 * PUT: Update a branding profile
 * DELETE: Delete a branding profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BrandingService } from '@/core/report-engine';
import { hasPermission } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const profile = await BrandingService.getById(params.id);
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message.includes('not found') ? 404 : 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const updated = await BrandingService.update(params.id, body, session.user.id);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await BrandingService.delete(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
