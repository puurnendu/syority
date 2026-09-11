import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CopyBodySchema = z.object({
    orgId: z.string().uuid(),
});

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { id: string; organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const body = await req.json();
    const parsed = CopyBodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    if (parsed.data.orgId !== orgId) {
        return NextResponse.json({ error: 'Organization mismatch' }, { status: 403 });
    }

    const { id: sourceId } = await params;

    const source = await prisma.workpack_templates.findFirst({
        where: { id: sourceId, deleted_at: null },
        include: {
            activities: { orderBy: { sequence_number: 'asc' } },
            checklist_items: { orderBy: { sequence_number: 'asc' } },
        },
    });

    if (!source) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (!source.is_system) {
        return NextResponse.json({ error: 'Only system templates can be copied' }, { status: 403 });
    }

    const newName = `Copy of ${source.name}`;

    const template = await prisma.workpack_templates.create({
        data: {
            organization_id: orgId,
            name: newName,
            equipment_type: source.equipment_type,
            job_type: source.job_type,
            description: source.description,
            is_system: false,
            is_active: true,
            created_by: user.id,
            activities: {
                create: source.activities.map((a) => ({
                    organization_id: orgId,
                    sequence_number: a.sequence_number,
                    activity_code: a.activity_code,
                    activity_library_id: a.activity_library_id,
                    description: a.description,
                    duration_hours: a.duration_hours != null ? Number(a.duration_hours) : null,
                    is_optional: a.is_optional,
                    hold_point_type: a.hold_point_type,
                    hold_point_description: a.hold_point_description,
                    udf_defaults: a.udf_defaults,
                    predecessor_sequences: a.predecessor_sequences,
                })) as never,
            },
            checklist_items: {
                create: source.checklist_items.map((item) => ({
                    organization_id: orgId,
                    checklist_type: item.checklist_type,
                    sequence_number: item.sequence_number,
                    description: item.description,
                    responsible_party: item.responsible_party,
                    is_mandatory: item.is_mandatory,
                })) as never,
            },
        },
        include: {
            activities: { orderBy: { sequence_number: 'asc' } },
            checklist_items: { orderBy: { sequence_number: 'asc' } },
        },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(template)), { status: 201 });
}
