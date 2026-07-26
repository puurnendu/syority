import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SiteService } from '@/core/tenant/services/SiteService';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const orgId = user.organization_id;

    try {
        const sites = await SiteService.getAll(orgId);
        return NextResponse.json(sites);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const orgId = user.organization_id;

    try {
        const body = await req.json();
        const site = await SiteService.create(orgId, body, user.id);
        return NextResponse.json(site);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const orgId = user.organization_id;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const updated = await SiteService.update(id, orgId, data, user.id);
        return NextResponse.json(updated);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
