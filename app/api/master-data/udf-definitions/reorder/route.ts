import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const body = await req.json();
        const orderedIds: string[] = Array.isArray(body.orderedIds) ? body.orderedIds : [];
        if (orderedIds.length === 0) return NextResponse.json({ success: true });

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < orderedIds.length; i++) {
                await tx.activityUdfDefinition.updateMany({
                    where: { id: orderedIds[i], organization_id: orgId },
                    data: { sort_order: i + 1 },
                });
            }
        });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Reorder failed' }, { status: 500 });
    }
}
