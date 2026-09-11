import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourceConstraintService } from '@/core/resources/ResourceConstraintService';

/**
 * GET /api/events/[eventId]/schedule/constraints
 * 
 * Returns dynamically calculated resource constraints for the given event.
 */
export const GET = withTenantGuard(async (req: NextRequest, ctx, session) => {
    const orgId = session.user.organization_id;
    const { eventId } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const resourceTypeId = searchParams.get('resourceTypeId') || undefined;
    const contractorId = searchParams.get('contractorId') || undefined;

    try {
        const constraints = await ResourceConstraintService.detectConstraints(
            eventId, 
            orgId,
            { startDate, endDate, resourceTypeId, contractorId }
        );

        return NextResponse.json({
            success: true,
            data: constraints
        });
    } catch (e: any) {
        if (e.message.includes('access denied')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
});
