import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const [openConstraints, draftLessons, whatsappPending] = await Promise.all([
        prisma.constraintLog
            .count({
                where: {
                    organization_id: orgId,
                    is_in_central_register: true,
                    status: { in: ['open', 'in_progress'] },
                    severity: { in: ['critical', 'high'] },
                    deleted_at: null,
                },
            })
            .catch(() => 0),
        prisma.lessonLearned
            .count({
                where: {
                    organization_id: orgId,
                    is_in_central_register: true,
                    status: 'draft',
                    deleted_at: null,
                },
            })
            .catch(() => 0),
        prisma.whatsappUpdate
            .count({
                where: { organization_id: orgId, status: 'parked_review' },
            })
            .catch(() => 0),
    ]);

    return NextResponse.json({
        open_constraints: openConstraints,
        draft_lessons: draftLessons,
        whatsapp_pending: whatsappPending,
    });
}
