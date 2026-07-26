import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string; jobId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id, jobId } = await context.params;

    const body = await req.json().catch(() => null);
    if (!Array.isArray(body?.accepted_indices)) {
        return NextResponse.json(
            { error: 'accepted_indices array required' },
            { status: 400 }
        );
    }

    const job = await prisma.aiExtractionJob.findFirst({
        where: {
            id: jobId,
            workpack_id: id,
            organization_id: orgId,
        },
        include: { result: true },
    });
    if (!job?.result)
        return NextResponse.json(
            { error: 'Job result not found' },
            { status: 404 }
        );

    const data = job.result.extracted_data_json as {
        suggestions?: Array<{
            title: string;
            description: string;
            recommendation: string;
            category: string;
            impact: string;
        }>;
    };

    const toCreate = (data.suggestions ?? []).filter((_, i) =>
        body.accepted_indices.includes(i)
    );

    const created = await Promise.all(
        toCreate.map((s) =>
            prisma.lessonLearned.create({
                data: {
                    organization_id: orgId,
                    workpack_id: id,
                    title: s.title,
                    description: s.description,
                    recommendation: s.recommendation,
                    category: s.category,
                    impact: s.impact,
                    status: 'draft',
                    is_in_central_register: true,
                    applicable_to: [],
                },
            })
        )
    );

    await prisma.aiExtractionResult.update({
        where: { ai_extraction_job_id: jobId },
        data: {
            review_status: 'approved',
            reviewed_by: session!.user.id,
            reviewed_at: new Date(),
            planner_review_json: {
                accepted_indices: body.accepted_indices,
                created_ids: created.map((l) => l.id),
            } as object,
        },
    });

    return NextResponse.json({
        created: created.length,
        lesson_ids: created.map((l) => l.id),
    });
}
