import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const HOLD_POINT_TYPES = ['witness_point', 'surveillance_point', 'hold_point'] as const;
type HoldPointType = typeof HOLD_POINT_TYPES[number];

const HOLD_TYPE_LABELS: Record<HoldPointType, string> = {
    witness_point: 'Witness Point',
    surveillance_point: 'Surveillance Point',
    hold_point: 'Hold Point',
};

/**
 * GET /api/workpacks/[id]/hold-points
 * Returns all activities in the workpack that have a hold_point_type set.
 * Groups by hold type and includes clearance status.
 */
export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id: workpackId } = await context.params;

    const activities = await prisma.activity.findMany({
        where: {
            workpack_id: workpackId,
            organization_id: orgId,
            deleted_at: null,
            hold_point_type: { not: null },
        },
        include: {
            qa_clearance_records: {
                orderBy: { cleared_at: 'desc' },
                take: 1,
                select: {
                    id: true,
                    cleared_at: true,
                    witness_name: true,
                    certificate_number: true,
                    notes: true,
                },
            },
        },
        orderBy: [{ hold_point_type: 'asc' }, { sequence_number: 'asc' }],
    });

    const grouped = Object.fromEntries(
        HOLD_POINT_TYPES.map((type) => [
            type,
            {
                label: HOLD_TYPE_LABELS[type],
                items: activities
                    .filter((a) => a.hold_point_type === type)
                    .map((a) => ({
                        id: a.id,
                        activity_number: a.activity_number,
                        activity_id: a.activity_id,
                        description: a.description,
                        hold_point_type: a.hold_point_type,
                        hold_point_description: a.hold_point_description,
                        status: a.status,
                        is_cleared: a.qa_clearance_records.length > 0,
                        clearance: a.qa_clearance_records[0] ?? null,
                        sequence_number: a.sequence_number,
                    })),
            },
        ])
    );

    const total = activities.length;
    const cleared = activities.filter((a) => a.qa_clearance_records.length > 0).length;

    return NextResponse.json({
        total,
        cleared,
        pending: total - cleared,
        grouped,
    });
}
