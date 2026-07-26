import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;
    const userId = (session!.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.notification.updateMany({
        where: {
            id,
            user_id: userId,
            organization_id: orgId,
        },
        data: {
            is_read: true,
            read_at: new Date(),
        },
    });
    return NextResponse.json({ success: true });
}
