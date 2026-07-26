import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST — toggle template is_active (true <-> false).
 * Only for org-owned templates; system templates cannot be toggled.
 */
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { id } = await params;

    const existing = await prisma.workpackTemplate.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (existing.is_system) {
        return NextResponse.json({ error: 'Cannot toggle system template' }, { status: 403 });
    }

    const updated = await prisma.workpackTemplate.update({
        where: { id },
        data: { is_active: !existing.is_active },
        include: {
            activities: { orderBy: { sequence_number: 'asc' } },
            checklist_items: { orderBy: { sequence_number: 'asc' } },
        },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}
