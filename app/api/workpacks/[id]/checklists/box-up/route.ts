import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DroppingBoxupService } from '@/modules/checklists/services/DroppingBoxupService';

/**
 * GET /api/workpacks/[id]/checklists/box-up
 * POST /api/workpacks/[id]/checklists/box-up
 * Mirrors the dropping checklist route but for checklist_type = 'box_up'
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const checklist = await DroppingBoxupService.getBoxUpChecklist(workpackId, session.user.organization_id!);
    return NextResponse.json(checklist || null);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id: workpackId } = await params;
        const checklist = await DroppingBoxupService.createBoxUpChecklist(
            workpackId,
            session.user.organization_id!,
            session.user.id
        );
        return NextResponse.json(checklist ?? {}, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create checklist';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
