import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string; jobId: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id, jobId } = await context.params;

    const job = await prisma.aiExtractionJob.findFirst({
        where: {
            id: jobId,
            workpack_id: id,
            organization_id: orgId,
        },
        include: {
            result: true,
            extraction_conflicts: {
                where: { status: 'pending' },
                orderBy: { created_at: 'asc' },
            },
        },
    });
    if (!job)
        return NextResponse.json(
            { error: 'Job not found' },
            { status: 404 }
        );
    return NextResponse.json(job);
}
