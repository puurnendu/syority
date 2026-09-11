import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ActivityService } from '@/modules/Activity/Services/ActivityService';
import { handleApiError } from '@/lib/apiErrorHandler';
import { ControlledValidationError } from '@/core/governance/ControlledValueResolver';

/**
 * POST /api/projects/[id]/schedule/activities
 * Creates a new activity directly linked to the project (no workpack).
 */
export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('nav.schedule');
        if (error) return error;

        const { id: projectId } = await params;
        const user = session.user as any;
        const body = await req.json();

        const activity = await ActivityService.createActivity({
            organization_id: user.organization_id,
            created_by: user.id,
            description: body.description,
            site_id: user.site_id || body.site_id,
            event_id: body.event_id,
            project_id: projectId,
            duration_hours: body.duration_hours,
            wbs_code: body.wbs_code,
            allow_loose: true,
            source_channel: 'api',
        });

        return NextResponse.json({ data: activity }, { status: 201 });
    } catch (error: any) {
        if (error instanceof ControlledValidationError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
        }
        return handleApiError(error);
    }
});
