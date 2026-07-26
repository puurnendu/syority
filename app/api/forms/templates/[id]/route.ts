import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { FormTemplateService } from '@/services/forms/FormTemplateService';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.view');
        if (error) return error;

        const { orgId } = orgScope(session);
        const { id } = params;
        const { searchParams } = new URL(req.url);
        const version = searchParams.get('version') ? parseInt(searchParams.get('version')!) : undefined;

        const template = await FormTemplateService.get(id as string, orgId, version);
        if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

        return NextResponse.json({ data: template });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const PATCH = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.manage');
        if (error) return error;

        const { orgId, userId } = orgScope(session);
        const { id } = params;
        const body = await req.json();

        const updated = await FormTemplateService.update(id as string, orgId, body, userId);

        return NextResponse.json({ data: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});

export const DELETE = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('forms.manage');
        if (error) return error;

        const { orgId, userId } = orgScope(session);
        const { id } = params;

        const archived = await FormTemplateService.archive(id as string, orgId, userId);

        return NextResponse.json({ data: archived });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
