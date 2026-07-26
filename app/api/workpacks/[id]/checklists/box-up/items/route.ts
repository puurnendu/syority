import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DroppingBoxupService } from '@/modules/checklists/services/DroppingBoxupService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id: workpackId } = await params;
        const orgId = session.user.organization_id!;

        const checklist = await DroppingBoxupService.getBoxUpChecklist(workpackId, orgId);
        if (!checklist) return NextResponse.json({ error: 'Box-up checklist not found' }, { status: 404 });

        const body = await req.json().catch(() => ({}));
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) return NextResponse.json({ error: 'items array required' }, { status: 400 });

        const updated = await DroppingBoxupService.addItemsToChecklist(
            checklist.id,
            orgId,
            items.map((item: { description?: string; responsible_party?: string; sequence_number?: number }) => ({
                description: String(item.description ?? '').trim() || 'Item',
                responsible_party: item.responsible_party != null ? String(item.responsible_party).trim() : undefined,
                sequence_number: item.sequence_number,
            }))
        );
        return NextResponse.json(updated ?? checklist);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to add items';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
