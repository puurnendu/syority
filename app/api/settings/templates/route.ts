import { NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateTemplateSchema = z.object({
    name: z.string().min(1),
    equipmentType: z.string().min(1),
    jobType: z.string().min(1),
    description: z.string().optional(),
    activities: z.array(z.any()).default([]),
    droppingItems: z.array(z.any()).default([]),
    boxupItems: z.array(z.any()).default([]),
    orgId: z.string().uuid(),
});

export async function GET() {
    const { session, error } = await guardApi('settings.templates.view');
    if (error) return error;
    const user = session!.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const templates = await prisma.workpack_templates.findMany({
        where: {
            OR: [{ organization_id: orgId }, { is_system: true }],
            deleted_at: null,
        },
        orderBy: [{ is_system: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(JSON.parse(JSON.stringify(templates)));
}

export async function POST(req: Request) {
    const { session, error } = await guardApi('settings.templates.edit');
    if (error) return error;
    const user = session!.user as { id: string; organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const body = await req.json();
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const {
        name,
        equipmentType,
        jobType,
        description,
        activities,
        droppingItems,
        boxupItems,
        orgId: bodyOrgId,
    } = parsed.data;

    if (bodyOrgId !== orgId) {
        return NextResponse.json({ error: 'Organization mismatch' }, { status: 403 });
    }

    const template = await prisma.workpack_templates.create({
        data: {
            organization_id: orgId,
            name,
            equipment_type: equipmentType,
            job_type: jobType,
            description: description ?? null,
            is_system: false,
            is_active: true,
            created_by: user.id,
            activities: {
                create: activities.map((a: Record<string, unknown>, i: number) => ({
                    organization_id: orgId,
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
            },
            checklist_items: {
                create: [
                    ...droppingItems.map((item: Record<string, unknown>, i: number) => ({
                        organization_id: orgId,
                        checklist_type: 'dropping' as const,
                        sequence_number: i + 1,
                        description: (item.description as string) ?? '',
                        responsible_party: (item.responsible_party as string) ?? null,
                        is_mandatory: (item.is_mandatory as boolean) ?? true,
                    })),
                    ...boxupItems.map((item: Record<string, unknown>, i: number) => ({
                        organization_id: orgId,
                        checklist_type: 'boxup' as const,
                        sequence_number: i + 1,
                        description: (item.description as string) ?? '',
                        responsible_party: (item.responsible_party as string) ?? null,
                        is_mandatory: (item.is_mandatory as boolean) ?? true,
                    })),
                ],
            },
        },
        include: {
            activities: { orderBy: { sequence_number: 'asc' } },
            checklist_items: { orderBy: { sequence_number: 'asc' } },
        },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(template)), { status: 201 });
}
