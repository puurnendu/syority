import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id } = await params;
        const orgId = session.user.organization_id;
        await assertTenantAccess('workpack', id, orgId);
        
        const workpack = await WorkpackService.getWorkpack(id, orgId);
        if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ data: workpack });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
});

export const PATCH = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('workpacks.edit');
        if (error) return error;
        
        const { id } = await params;
        const orgId = session.user.organization_id;
        await assertTenantAccess('workpack', id, orgId);
        
        const body = await req.json();
        const userId = session.user.id;

        // workpack_id_code — read-only after creation
        if (body.workpack_id_code !== undefined) {
            return NextResponse.json(
                { error: 'Workpack ID Code cannot be changed after creation' },
                { status: 400 }
            );
        }

        const updateData = { ...body };
        delete (updateData as Record<string, unknown>).workpack_id_code;

        // SAP Work Order — only super_admin may set/change
        if (body.sap_work_order !== undefined) {
            const { isSuperAdmin } = orgScope(session!);
            if (!isSuperAdmin) {
                return NextResponse.json(
                    { error: 'Only platform admins can set SAP Work Order' },
                    { status: 403 }
                );
            }
            updateData.sap_work_order = body.sap_work_order?.trim() ?? null;
        }

        const workpack = await WorkpackService.updateWorkpack(id, orgId, updateData, userId);
        return NextResponse.json({ data: workpack });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
});

const ROLES_CAN_DELETE_WORKPACK = ['super_admin', 'org_admin', 'tenant_admin'];

export const DELETE = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('workpacks.view');
        if (error) return error;
        
        const role = (session?.user as { role?: string })?.role ?? '';
        if (!ROLES_CAN_DELETE_WORKPACK.includes(role)) {
            return NextResponse.json(
                { error: 'You do not have permission to delete workpacks' },
                { status: 403 }
            );
        }
        
        const { id } = await params;
        const orgId = session.user.organization_id;
        await assertTenantAccess('workpack', id, orgId);
        
        const deletedBy = session.user.id;
        await WorkpackService.deleteWorkpack(id, orgId, deletedBy);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
});
