import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Any authenticated user can submit draft items from workpack materials. */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const orgId = (session.user as any).organization_id;
    if (!orgId) {
        return NextResponse.json({ error: 'No organisation' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.description?.trim()) {
        return NextResponse.json(
            { error: 'Description required' },
            { status: 400 }
        );
    }

    const existing = await prisma.item_catalog.findFirst({
        where: {
            organization_id: orgId,
            description: {
                equals: body.description.trim(),
                mode: 'insensitive',
            },
            is_active: false,
        },
        select: { id: true },
    });
    if (existing) {
        return NextResponse.json(
            { skipped: true, id: existing.id },
            { status: 200 }
        );
    }

    const draftCode = `DRAFT-${Date.now().toString(36).toUpperCase()}`;

    const item = await prisma.item_catalog.create({
        data: {
            organization_id: orgId,
            item_code: draftCode,
            description: body.description.trim(),
            unit_of_measure: body.unit_of_measure ?? 'EA',
            item_category: 'other',
            is_active: false,
            import_batch_id: 'user_entry',
        },
    });

    return NextResponse.json(
        { created: true, id: item.id, draft_code: draftCode },
        { status: 201 }
    );
}
