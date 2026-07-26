import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { FormInstanceService } from '@/services/forms/FormInstanceService';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.view');
        if (error) return error;

        const { orgId } = orgScope(session);
        const { searchParams } = new URL(req.url);

        const result = await FormInstanceService.list({
            organization_id: orgId,
            workpack_id: searchParams.get('workpack_id') ?? undefined,
            status: searchParams.get('status') ?? undefined,
            page: searchParams.has('page') ? parseInt(searchParams.get('page')!) : undefined,
            limit: searchParams.has('limit') ? parseInt(searchParams.get('limit')!) : undefined,
        });

        return NextResponse.json({ data: result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.execute');
        if (error) return error;

        const { orgId, userId } = orgScope(session);
        const body = await req.json();

        const instance = await FormInstanceService.createFromTemplate({
            ...body,
            organization_id: orgId,
            user_id: userId,
        });

        return NextResponse.json({ data: instance }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
