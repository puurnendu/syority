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
        where: {
            id,
            organization_id: orgId,
            deleted_at: null,
        },
        select: {
            sap_work_order: true,
            workpack_id_code: true,
            title: true,
            status: true,
            planned_start_date: true,
            planned_end_date: true,
        },
    });

    if (!workpack) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
        sap_work_order: workpack.sap_work_order,
        sync_status: workpack.sap_work_order ? 'linked' : 'unlinked',
        workpack_id_code: workpack.workpack_id_code,
        sap_available: false,
        message: workpack.sap_work_order
            ? `Linked to SAP WO ${workpack.sap_work_order}`
            : 'No SAP Work Order linked',
    });
}

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;

    const rawRole = (session!.user as { role?: string }).role ?? '';
    const role = String(rawRole).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    const isSuperAdmin = 
        role === 'super_admin' || 
        role === 'org_admin' || 
        role.includes('super') ||
        role.includes('admin') ||
        (session!.user as any).is_super_admin === true ||
        (session!.user as any).isSuperAdmin === true;

    if (!isSuperAdmin) {
        return NextResponse.json(
            { error: 'Admin access required to set SAP WO' },
            { status: 403 }
        );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const wo = (body.sap_work_order as string)?.trim() ?? '';
    if (wo && !/^[A-Z0-9]{6,12}$/.test(wo)) {
        return NextResponse.json(
            {
                error:
                    'Invalid SAP Work Order format. Expected 6–12 alphanumeric characters.',
            },
            { status: 400 }
        );
    }

    if (wo) {
        const conflict = await prisma.workpack.findFirst({
            where: {
                sap_work_order: wo,
                organization_id: orgId,
                id: { not: id },
                deleted_at: null,
            },
            select: { workpack_id_code: true },
        });
        if (conflict) {
            return NextResponse.json(
                {
                    error: `SAP WO ${wo} is already linked to workpack ${conflict.workpack_id_code}.`,
                },
                { status: 409 }
            );
        }
    }

    const updated = await prisma.workpack.update({
        where: { id },
        data: { sap_work_order: wo || null },
        select: { sap_work_order: true },
    });

    return NextResponse.json({
        sap_work_order: updated.sap_work_order,
        sync_status: updated.sap_work_order ? 'linked' : 'unlinked',
        message: updated.sap_work_order
            ? `Linked to SAP WO ${updated.sap_work_order}`
            : 'SAP Work Order removed',
    });
}
