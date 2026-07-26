import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { FormTemplateService } from '@/services/forms/FormTemplateService';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.view');
        if (error) return error;

        const { orgId } = orgScope(session);
        const { searchParams } = new URL(req.url);

        const result = await FormTemplateService.list({
            organization_id: orgId,
            form_type: searchParams.get('form_type') ?? undefined,
            is_active: searchParams.has('is_active') ? searchParams.get('is_active') === 'true' : undefined,
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
        const { error } = await guardApi('forms.manage');
        if (error) return error;

        const { orgId, userId } = orgScope(session);
        const body = await req.json();

        const template = await FormTemplateService.create({
            ...body,
            organization_id: orgId,
            created_by: userId,
        });

        return NextResponse.json({ data: template }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
