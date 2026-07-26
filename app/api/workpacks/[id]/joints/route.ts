import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { JointIntegrityService } from '@/modules/JointIntegrity/Services/JointIntegrityService';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const [joints, summary] = await Promise.all([
            prisma.jointIntegrityItem.findMany({
                where: { workpack_id: id, organization_id: orgId, deleted_at: null },
                orderBy: { joint_number: 'asc' },
            }),
            JointIntegrityService.getSummary(id, orgId),
        ]);
        return NextResponse.json({ data: joints, meta: { summary } });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const userId = await getUserIdFromRequest(req);
        const wp = await prisma.workpack.findFirst({ where: { id, organization_id: orgId }, select: { organization_id: true, site_id: true } });
        if (!wp) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        const { action, ...data } = body;
        if (action === 'assemble') {
            return NextResponse.json({ data: await JointIntegrityService.markAssembled(data.id, orgId, userId) });
        }
        if (action === 'inspect') {
            return NextResponse.json({ data: await JointIntegrityService.markInspected(data.id, orgId, userId) });
        }
        if (action === 'sign-off') {
            return NextResponse.json({ data: await JointIntegrityService.signOff(data.id, orgId, userId) });
        }
        if (action === 'update') {
            const existing = await prisma.jointIntegrityItem.findFirst({
                where: { id: data.id, workpack_id: id, organization_id: orgId, deleted_at: null },
            });
            if (!existing) return NextResponse.json({ error: 'Joint not found' }, { status: 404 });
            const updatePayload: Record<string, unknown> = {};
            if (data.gasket_material !== undefined) updatePayload.gasket_material = data.gasket_material;
            if (data.bolt_material !== undefined) updatePayload.bolt_material = data.bolt_material;
            if (data.bolt_quantity !== undefined) updatePayload.bolt_quantity = data.bolt_quantity;
            if (data.flange_size !== undefined) updatePayload.flange_size = data.flange_size;
            if (data.rating !== undefined) updatePayload.rating = data.rating;
            if (data.flange_type !== undefined) updatePayload.flange_type = data.flange_type;
            const updated = await prisma.jointIntegrityItem.update({
                where: { id: data.id },
                data: updatePayload,
            });
            if (updated.flange_size && updated.rating && (data.flange_size !== undefined || data.rating !== undefined || data.flange_type !== undefined)) {
                const { generateJointMaterialLines } = await import('@/lib/materials/materialLineGenerator');
                await generateJointMaterialLines(
                    updated.id, id, orgId,
                    updated.flange_size, updated.rating, (updated.flange_type as string) ?? 'RF'
                ).catch((e) => console.error('[Materials] Joint line regen failed:', (e as Error).message));
            }
            return NextResponse.json({ data: updated });
        }

        const joint = await JointIntegrityService.createJoint({
            ...data, workpack_id: id, organization_id: wp.organization_id, site_id: wp.site_id, created_by: userId,
        });
        if (joint.flange_size && joint.rating) {
            const { generateJointMaterialLines } = await import('@/lib/materials/materialLineGenerator');
            const flangeType = (joint as any).flange_type ?? 'RF';
            await generateJointMaterialLines(
                joint.id, id, wp.organization_id,
                joint.flange_size, joint.rating, flangeType
            ).catch((e) => console.error('[Materials] Joint line gen failed:', (e as Error).message));
        }
        return NextResponse.json({ data: joint }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
