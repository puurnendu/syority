import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { FormInstanceService } from '@/services/forms/FormInstanceService';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.view');
        if (error) return error;

        const { orgId } = orgScope(session);
        const { id } = params;

        const instance = await FormInstanceService.get(id as string, orgId);
        if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

        return NextResponse.json({ data: instance });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const PATCH = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.execute');
        if (error) return error;

        const { orgId, userId } = orgScope(session);
        const { id } = params;
        const body = await req.json();

        const updated = await FormInstanceService.saveDraft(id as string, orgId, body.payload ?? body, userId);

        return NextResponse.json({ data: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
