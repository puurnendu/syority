import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { ActivityService } from '@/modules/Activity/Services/ActivityService';
import { handleApiError } from '@/lib/apiErrorHandler';
import { ControlledValidationError } from '@/core/governance/ControlledValueResolver';

/**
 * GET /api/activities
 * Lists activities for the tenant, optionally filtered by event_id or workpack_id.
 */
export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('nav.schedule');
        if (error) return error;

        const orgId = session.user.organization_id;
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get('event_id') ?? undefined;
        const workpackId = searchParams.get('workpack_id') ?? undefined;

        const activities = await prisma.activity.findMany({
            where: {
                organization_id: orgId,
                deleted_at: null,
                ...(eventId && { event_id: eventId }),
                ...(workpackId && { workpack_id: workpackId }),
            },
            include: {
                discipline: { select: { id: true, name: true, code: true, color: true } },
                workpack: { select: { id: true, workpack_id_code: true, title: true } },
            },
            orderBy: [{ sequence_number: 'asc' }, { created_at: 'asc' }],
        });

        return NextResponse.json({ data: activities });
    } catch (error: any) {
        console.error('[GetActivities] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

/**
 * POST /api/activities
 * Creates a new loose activity (no project / no workpack).
 */
export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('nav.schedule');
        if (error) return error;

        const orgId = session.user.organization_id;
        const user = session.user as any;
        const body = await req.json();

        const activity = await ActivityService.createActivity({
            organization_id: orgId,
            created_by: user.id,
            description: body.description,
            workpack_id: body.workpack_id || undefined,
            event_id: body.event_id || undefined,
            site_id: body.site_id || user.site_id || undefined,
            duration_hours: body.duration_hours,
            hold_point_type: body.hold_point_type,
            hold_point_description: body.hold_point_description,
            responsible: body.responsible,
            discipline_id: body.discipline_id,
            discipline: body.discipline,
            notes: body.notes,
            wbs_code: body.wbs_code,
            activity_code: body.activity_code,
            standard_activity_type_id: body.standard_activity_type_id,
            standard_activity_type: body.standard_activity_type,
            allow_loose: !body.workpack_id,
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
