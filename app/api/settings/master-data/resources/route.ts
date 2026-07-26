import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { ResourceService } from '@/core/master-data/services/ResourceService';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.view');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const resources = await ResourceService.getAll(orgId);
        return NextResponse.json(resources);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.edit');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const body = await req.json();
        const resource = await ResourceService.create(orgId, body, user.id);
        return NextResponse.json(resource);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.edit');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const updated = await ResourceService.update(id, orgId, data, user.id);
        return NextResponse.json(updated);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
