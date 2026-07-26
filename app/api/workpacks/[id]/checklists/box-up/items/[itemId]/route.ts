import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DroppingBoxupService } from '@/modules/checklists/services/DroppingBoxupService';

/**
 * PATCH /api/workpacks/[id]/checklists/box-up/items/[itemId]
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { itemId } = await params;
    const orgId = session.user.organization_id!;
    const body = await req.json().catch(() => ({}));

    const updateData: Parameters<typeof DroppingBoxupService.updateItem>[3] = {};
    if (body.is_done !== undefined) updateData.is_done = Boolean(body.is_done);
    if (body.signed_at !== undefined) updateData.signed_at = body.signed_at ? new Date(body.signed_at) : null;
    if (body.notes !== undefined) updateData.notes = body.notes ?? null;

    const updated = await DroppingBoxupService.updateItem(itemId, orgId, session.user.id, updateData);
    return NextResponse.json(updated);
}
