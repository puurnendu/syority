import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { FormInstanceService } from '@/services/forms/FormInstanceService';

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.execute');
        if (error) return error;

        const { orgId, userId } = orgScope(session);
        const { id } = params;
        const body = await req.json();

        const submitted = await FormInstanceService.submit(id as string, orgId, body.payload ?? body, userId);

        return NextResponse.json({ data: submitted });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
