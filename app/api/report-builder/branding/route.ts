/**
 * M7.6B — Branding Profiles API
 * GET: List branding profiles for the user's organization
 * POST: Create a new branding profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BrandingService } from '@/core/report-engine';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const profiles = await BrandingService.list(session.user.organizationId);
    return NextResponse.json(profiles);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const profile = await BrandingService.create(
      { ...body, organization_id: session.user.organizationId },
      session.user.id
    );
    return NextResponse.json(profile, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
