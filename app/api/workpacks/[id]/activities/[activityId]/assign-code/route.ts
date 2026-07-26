import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

/**
 * POST: Assign the next activity_number to this activity if it doesn't have one.
 * Format: {TAG}_{3-digit} e.g. E435_001
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    try {
        const { id: workpackId, activityId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(req);

        const activity = await prisma.activity.findFirst({
            where: { id: activityId, workpack_id: workpackId, organization_id: orgId, deleted_at: null },
        });
        if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        if (activity.activity_number?.trim()) {
            return NextResponse.json({ data: activity, message: 'Already has code' });
        }

        const workpack = await prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId },
            select: { unit_code: true, title: true },
        });
        if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        const tag = (workpack.unit_code || workpack.title || 'ACT')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .substring(0, 6) || 'ACT';
        const withCodeCount = await prisma.activity.count({
            where: {
                workpack_id: workpackId,
                deleted_at: null,
                activity_number: { not: null },
            },
        });
        const seq = String(withCodeCount + 1).padStart(3, '0');
        const code = `${tag}_${seq}`;

        const updated = await prisma.activity.update({
            where: { id: activityId },
            data: { activity_number: code, updated_by: userId },
        });
        return NextResponse.json({ data: updated, assigned: code });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
