import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { RoleService } from '@/core/tenant/services/RoleService';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('settings.roles.view');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const roles = await RoleService.getAll(orgId);
        return NextResponse.json(roles);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { session, error } = await guardApi('settings.roles.edit');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const body = await req.json();
        const role = await RoleService.create(orgId, body, user.id);
        return NextResponse.json(role);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const { session, error } = await guardApi('settings.roles.edit');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const updated = await RoleService.update(id, orgId, data);
        return NextResponse.json(updated);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
