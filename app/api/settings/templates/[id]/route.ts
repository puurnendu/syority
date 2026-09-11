import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { id } = await params;

    const template = await prisma.workpack_templates.findFirst({
        where: {
            id,
            deleted_at: null,
            OR: [{ organization_id: orgId }, { is_system: true }],
        },
        include: {
            activities: { orderBy: { sequence_number: 'asc' } },
            checklist_items: { orderBy: { sequence_number: 'asc' } },
        },
    });

    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    return NextResponse.json(JSON.parse(JSON.stringify(template)));
}

const UpdateTemplateSchema = z.object({
    name: z.string().min(1).optional(),
    equipmentType: z.string().min(1).optional(),
    jobType: z.string().min(1).optional(),
    description: z.string().optional(),
    activities: z.array(z.any()).optional(),
    droppingItems: z.array(z.any()).optional(),
    boxupItems: z.array(z.any()).optional(),
    orgId: z.string().uuid().optional(),
});

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { id: string; organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { id } = await params;

    const existing = await prisma.workpack_templates.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (existing.is_system) {
        return NextResponse.json({ error: 'Cannot edit system template' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateTemplateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const data = parsed.data;

    const activities = (data.activities ?? []) as Array<Record<string, unknown>>;
    const droppingItems = (data.droppingItems ?? []) as Array<Record<string, unknown>>;
    const boxupItems = (data.boxupItems ?? []) as Array<Record<string, unknown>>;
    const doReplace = data.activities !== undefined || data.droppingItems !== undefined || data.boxupItems !== undefined;

    await prisma.$transaction(async (tx) => {
        await tx.workpack_templates.update({
            where: { id },
            data: {
                ...(data.name != null && { name: data.name }),
                ...(data.equipmentType != null && { equipment_type: data.equipmentType }),
                ...(data.jobType != null && { job_type: data.jobType }),
                ...(data.description != null && { description: data.description }),
            },
        });

        if (doReplace) {
            await tx.workpack_template_activities.deleteMany({ where: { template_id: id } });
            await tx.templateChecklistItem.deleteMany({ where: { template_id: id } });

            if (activities.length > 0) {
                await tx.workpack_template_activities.createMany({
                    data: activities.map((a, i) => ({
                        organization_id: orgId,
                        template_id: id,
                        sequence_number: (a.sequence_number as number) ?? i + 1,
                        activity_code: (a.activity_code as string) ?? null,
                        activity_library_id: (a.activity_code_library_id as string) ?? (a.activity_library_id as string) ?? null,
                        description: (a.description as string) ?? '',
                        duration_hours: (a.duration_hours as number) ?? null,
                        is_optional: (a.is_optional as boolean) ?? false,
                        hold_point_type: (a.hold_point_type as string) ?? null,
                        udf_defaults: (a.udf_defaults as object) ?? null,
                        predecessor_sequences: (a.predecessor_sequences as number[]) ?? [],
                    })),
                });
            }

            const dropData = droppingItems.map((item, i) => ({
                organization_id: orgId,
                template_id: id,
                checklist_type: 'dropping' as const,
                sequence_number: i + 1,
                description: (item.description as string) ?? '',
                responsible_party: (item.responsible_party as string) ?? null,
                is_mandatory: (item.is_mandatory as boolean) ?? true,
            }));
            const boxData = boxupItems.map((item, i) => ({
                organization_id: orgId,
                template_id: id,
                checklist_type: 'boxup' as const,
                sequence_number: i + 1,
                description: (item.description as string) ?? '',
                responsible_party: (item.responsible_party as string) ?? null,
                is_mandatory: (item.is_mandatory as boolean) ?? true,
            }));
            if (dropData.length > 0 || boxData.length > 0) {
                await tx.templateChecklistItem.createMany({ data: [...dropData, ...boxData] });
            }
        }
    });

    const template = await prisma.workpack_templates.findUnique({
        where: { id },
        include: {
            activities: { orderBy: { sequence_number: 'asc' } },
            checklist_items: { orderBy: { sequence_number: 'asc' } },
        },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(template)));
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { id } = await params;

    const existing = await prisma.workpack_templates.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (existing.is_system) {
        return NextResponse.json({ error: 'Cannot delete system template' }, { status: 403 });
    }

    await prisma.workpack_templates.update({
        where: { id },
        data: { deleted_at: new Date() },
    });

    return NextResponse.json({ ok: true });
}
