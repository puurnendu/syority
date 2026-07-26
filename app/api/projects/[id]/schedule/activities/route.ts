import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

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

        // 1. Resolve Site ID (mandatory for Activity model)
        let siteId = user.site_id;
        if (!siteId) {
            const firstSite = await prisma.site.findFirst({
                where: { organization_id: user.organization_id, is_active: true },
                select: { id: true }
            });
            siteId = firstSite?.id;
        }

        if (!siteId) {
            return NextResponse.json({ error: 'No active site found for your organization.' }, { status: 400 });
        }

        // 2. Create the loose activity
        const activity = await prisma.activity.create({
            data: {
                organization_id: user.organization_id,
                site_id: siteId,
                project_id: projectId,
                description: body.description || 'New Activity',
                planned_start: body.planned_start || new Date(),
                duration_hours: body.duration_hours || 8,
                status: 'not_started',
                wbs_code: body.wbs_code || null,
                created_by: user.id,
            }
        });

        return NextResponse.json({ data: activity }, { status: 201 });
    } catch (error: any) {
        console.error('[CreateProjectActivity] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
