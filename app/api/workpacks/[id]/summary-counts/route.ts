import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;

    const workpack = await prisma.workpack.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
        select: { id: true },
    });
    if (!workpack) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [
        openConstraints,
        openHoldPoints,
        pendingCerts,
        aiJoints,
        aiMaterials,
        aiTools,
        aiConstraints,
        activitiesCount,
        materialsCount,
        preparationCount,
        cleaningCount,
        constraintsCount,
        jointsCount,
        blindsCount,
        qaCount,
        certificatesCount,
        documentsCount,
        lessonsCount,
        toolsCount,
    ] = await Promise.all([
        prisma.constraintLog
            .count({
                where: {
                    workpack_id: id,
                    status: { in: ['open', 'in_progress'] },
                    deleted_at: null,
                },
            })
            .catch(() => 0),
        prisma.activity
            .count({
                where: {
                    workpack_id: id,
                    deleted_at: null,
                    hold_point_type: { in: ['H', 'W'] },
                    qa_clearances: { none: {} },
                },
            })
            .catch(() => 0),
        prisma.certificateInstance
            .count({
                where: {
                    workpack_id: id,
                    deleted_at: null,
                    status: { in: ['not_started', 'in_progress'] },
                },
            })
            .catch(() => 0),
        prisma.jointIntegrityItem.count({ where: { workpack_id: id, deleted_at: null, ai_generated: true } }).catch(() => 0),
        prisma.workpack_material_lines.count({ where: { workpack_id: id, deleted_at: null, ai_generated: true } }).catch(() => 0),
        prisma.workpack_tools.count({ where: { workpack_id: id, ai_generated: true } }).catch(() => 0),
        prisma.constraintLog.count({ where: { workpack_id: id, deleted_at: null, ai_generated: true } }).catch(() => 0),
        prisma.activity.count({ where: { workpack_id: id, deleted_at: null } }).catch(() => 0),
        prisma.workpack_material_lines.count({ where: { workpack_id: id, deleted_at: null } }).catch(() => 0),
        prisma.dropping_boxup_checklists.count({ where: { workpack_id: id } }).catch(() => 0),
        prisma.cleaning_records.count({ where: { workpack_id: id } }).catch(() => 0),
        prisma.constraintLog.count({ where: { workpack_id: id, deleted_at: null } }).catch(() => 0),
        prisma.jointIntegrityItem.count({ where: { workpack_id: id, deleted_at: null } }).catch(() => 0),
        prisma.blind.count({ where: { workpack_id: id } }).catch(() => 0),
        prisma.qa_clearance_records.count({ where: { workpack_id: id } }).catch(() => 0),
        prisma.certificateInstance.count({ where: { workpack_id: id, deleted_at: null } }).catch(() => 0),
        prisma.workpackDocument.count({ where: { workpack_id: id, deleted_at: null } }).catch(() => 0),
        prisma.lessonLearned.count({ where: { workpack_id: id } }).catch(() => 0),
        prisma.workpack_tools.count({ where: { workpack_id: id } }).catch(() => 0),
    ]);

    return NextResponse.json({
        open_constraints: openConstraints,
        open_hold_points: openHoldPoints,
        pending_certs: pendingCerts,
        ai_generated_joints: aiJoints,
        ai_generated_materials: aiMaterials,
        ai_generated_tools: aiTools,
        ai_generated_constraints: aiConstraints,
        section_counts: {
            activities: activitiesCount,
            materials: materialsCount,
            preparation: preparationCount,
            cleaning: cleaningCount,
            constraints: constraintsCount,
            joints_blinds: jointsCount + blindsCount,
            tools: toolsCount,
            qa_clearance: qaCount,
            certificates: certificatesCount,
            documents: documentsCount,
            lessons: lessonsCount,
        },
    });
}
