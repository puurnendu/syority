import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { extractRequestMeta } from '@/lib/requestMeta';

/**
 * PATCH /api/workpacks/[id]/hold-points/[activityId]
 * Body:
 *   { hold_point_type?: string; hold_point_description?: string }  — set/update hold point
 *   { clear: true; witness_name?: string; certificate_number?: string; notes?: string }  — record clearance
 *   { hold_point_type: null }  — remove hold point designation
 */
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id: workpackId, activityId } = await context.params;
    const userId = session!.user.id;

    const body = await req.json().catch(() => ({}));
    const meta = extractRequestMeta(req);

    // Verify the activity belongs to this workpack + org
    const activity = await prisma.activity.findFirst({
        where: { id: activityId, workpack_id: workpackId, organization_id: orgId, deleted_at: null },
    });
    if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

    // Case 1: Record clearance
    if (body.clear === true) {
        const clearance = await prisma.qa_clearance_records.create({
            data: {
                id: crypto.randomUUID(),
                organization_id: orgId,
                activity_id: activityId,
                workpack_id: workpackId,
                cleared_by: userId,
                cleared_at: new Date(),
                witness_name: body.witness_name ?? null,
                certificate_number: body.certificate_number ?? null,
                notes: body.notes ?? null,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            model_name: 'QaClearanceRecord',
            model_id: clearance.id,
            action: 'created',
            new_values: { activity_id: activityId, workpack_id: workpackId },
            ip_address: meta.ip,
            user_agent: meta.userAgent,
        });

        return NextResponse.json({ clearance, message: 'Hold point cleared' });
    }

    // Case 2: Update hold point type / description
    const updateData: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'hold_point_type')) {
        updateData.hold_point_type = body.hold_point_type ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'hold_point_description')) {
        updateData.hold_point_description = body.hold_point_description ?? null;
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const updated = await prisma.activity.update({
        where: { id: activityId },
        data: updateData,
        select: {
            id: true,
            hold_point_type: true,
            hold_point_description: true,
            description: true,
        },
    });

    await AuditService.log({
        organization_id: orgId,
        user_id: userId,
        model_name: 'Activity',
        model_id: activityId,
        action: 'updated',
        new_values: updateData,
        ip_address: meta.ip,
        user_agent: meta.userAgent,
    });

    return NextResponse.json(updated);
}
