import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { OrgService } from '@/core/tenant/services/OrgService';
import { withTenantGuard } from '@/lib/withTenantGuard';

export const GET = withTenantGuard(async (req, { params }, session) => {
    const { error } = await guardApi('settings.org.view');
    if (error) return error;
    const orgId = session.user.organization_id;

    try {
        const org = await OrgService.getById(orgId);
        return NextResponse.json(org);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
});

export const PUT = withTenantGuard(async (req, { params }, session) => {
    const { error } = await guardApi('settings.org.edit');
    if (error) return error;
    const orgId = session.user.organization_id;

    try {
        const body = await req.json();
        const updated = await OrgService.update(orgId, body, session.user.id);
        return NextResponse.json(updated);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
});
