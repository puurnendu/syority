import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string; conflictId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { conflictId } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body?.resolution || !body?.resolution_note?.trim()) {
        return NextResponse.json(
            {
                error: 'resolution and resolution_note are required',
            },
            { status: 400 }
        );
    }

    const conflict = await prisma.extraction_conflicts.findFirst({
        where: {
            id: conflictId,
            organization_id: orgId,
            status: 'pending',
        },
    });
    if (!conflict)
        return NextResponse.json(
            { error: 'Conflict not found' },
            { status: 404 }
        );

    const updated = await prisma.extraction_conflicts.update({
        where: { id: conflictId },
        data: {
            status: 'resolved',
            resolution: body.resolution,
            resolution_value: body.resolution_value ?? null,
            resolution_note: body.resolution_note.trim(),
            resolved_by: session!.user.id,
            resolved_at: new Date(),
        },
    });

    return NextResponse.json(updated);
}
