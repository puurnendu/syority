import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { DisciplineService } from '@/core/master-data/services/DisciplineService';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.view');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const disciplines = await DisciplineService.getAll(orgId);
        return NextResponse.json(disciplines);
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
        const discipline = await DisciplineService.create(orgId, body, user.id);
        return NextResponse.json(discipline);
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
        const updated = await DisciplineService.update(id, orgId, data, user.id);
        return NextResponse.json(updated);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
