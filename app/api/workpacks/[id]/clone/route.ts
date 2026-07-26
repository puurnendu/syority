import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';

/**
 * POST /api/workpacks/[id]/clone
 * Body: { title?: string }   — optional title override for the cloned workpack
 * Returns: { data: { id, workpack_number, title } }
 *
 * Copies: core fields, activities, materials, tools.
 * Does NOT copy: joints, blinds, clearances, certificates, punch items, attachments.
 */
export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id } = await params;
        const orgId = session.user.organization_id;
        const userId = session.user.id;

        await assertTenantAccess('workpack', id, orgId);

        const body = await req.json().catch(() => ({}));
        const titleOverride: string | undefined = body?.title?.trim() || undefined;

        const clone = await WorkpackService.cloneWorkpack(id, orgId, userId, titleOverride);

        return NextResponse.json({
            data: {
                id: clone.id,
                workpack_number: clone.workpack_number,
                title: clone.title,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Clone failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
});
