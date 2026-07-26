import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

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

        // 1. Resolve Site ID
        let siteId = body.site_id || user.site_id;
        if (!siteId) {
            const firstSite = await prisma.site.findFirst({
                where: { organization_id: orgId, is_active: true },
                select: { id: true }
            });
            siteId = firstSite?.id;
        }

        if (!siteId) {
            return NextResponse.json({ error: 'No active site found.' }, { status: 400 });
        }

        // 2. Create activity
        const activity = await prisma.activity.create({
            data: {
                organization_id: orgId,
                site_id: siteId,
                project_id: body.project_id || null,
                workpack_id: body.workpack_id || null,
                description: body.description || 'New Activity',
                planned_start: body.planned_start ? new Date(body.planned_start) : null,
                duration_hours: body.duration_hours || 8,
                status: body.status || 'not_started',
                progress_percent: body.progress_percent || 0,
                responsible: body.responsible || null,
                discipline_id: body.discipline_id || null,
                notes: body.notes || null,
                wbs_code: body.wbs_code || null,
                created_by: user.id,
            }
        });

        return NextResponse.json({ data: activity }, { status: 201 });
    } catch (error: any) {
        console.error('[CreateActivity] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
