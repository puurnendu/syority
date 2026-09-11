import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourceLevelingService } from '@/core/resources/ResourceLevelingService';

/**
 * POST /api/events/[eventId]/schedule/level-resources
 * 
 * Generates leveling recommendations to resolve resource over-allocations.
 * This is a SIMULATION ONLY endpoint and does not mutate the database.
 */
export const POST = withTenantGuard(async (req: NextRequest, ctx, session) => {
    const orgId = session.user.organization_id;
    const { eventId } = await ctx.params;

    try {
        const body = await req.json().catch(() => ({}));
        
        const options = {
            startDate: body.startDate || undefined,
            endDate: body.endDate || undefined,
            resourceTypeId: body.resourceTypeId || undefined,
            contractorId: body.contractorId || undefined
        };

        const result = await ResourceLevelingService.generateLevelingRecommendations(
            eventId, 
            orgId,
            options
        );

        return NextResponse.json(result);
    } catch (e: any) {
        if (e.message.includes('access denied')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
});
