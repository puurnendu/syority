import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import type { TighteningMethod, JointStatus } from '@prisma/client';

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; jointId: string }> }
) {
    try {
        const { id: workpackId, jointId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(req);

        const existing = await prisma.jointIntegrityItem.findFirst({
            where: { id: jointId, workpack_id: workpackId, organization_id: orgId, deleted_at: null },
        });
        if (!existing) return NextResponse.json({ error: 'Joint not found' }, { status: 404 });

        const body = await req.json();
        const data: Record<string, unknown> = {};
        if (body.joint_number !== undefined) data.joint_number = body.joint_number;
        if (body.line_number !== undefined) data.line_number = body.line_number;
        if (body.specification !== undefined) data.specification = body.specification;
        if (body.rating !== undefined) data.rating = body.rating;
        if (body.flange_size !== undefined) data.flange_size = body.flange_size;
        if (body.location !== undefined) data.location = body.location;
        if (body.flange_type !== undefined) data.flange_type = body.flange_type;
        if (body.gasket_material !== undefined) data.gasket_material = body.gasket_material;
        if (body.bolt_reference_standard !== undefined) data.bolt_reference_standard = body.bolt_reference_standard;
        if (body.tightening_method !== undefined) {
            const v = body.tightening_method;
            if (['torque', 'tensioning', 'manual'].includes(v)) data.tightening_method = v as TighteningMethod;
        }
        if (body.torque_tightening_value !== undefined) data.torque_tightening_value = body.torque_tightening_value;
        if (body.status !== undefined) {
            const v = body.status;
            if (['pending', 'assembled', 'inspected', 'signed_off', 'dismantled'].includes(v)) data.status = v as JointStatus;
        }
        data.updated_by = userId ?? undefined;

        const updated = await prisma.jointIntegrityItem.update({
            where: { id: jointId },
            data,
        });
        return NextResponse.json({ data: updated });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string; jointId: string }> }
) {
    try {
        const { id: workpackId, jointId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(req);

        const existing = await prisma.jointIntegrityItem.findFirst({
            where: { id: jointId, workpack_id: workpackId, organization_id: orgId, deleted_at: null },
        });
        if (!existing) return NextResponse.json({ error: 'Joint not found' }, { status: 404 });

        await prisma.jointIntegrityItem.update({
            where: { id: jointId },
            data: { deleted_at: new Date(), updated_by: userId ?? undefined },
        });
        return NextResponse.json({ data: { id: jointId, deleted: true } });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
