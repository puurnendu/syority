import { prisma } from '@/lib/prisma';

export async function autoAttachCertificates(
    workpackId: string,
    organizationId: string,
    equipmentType: string
): Promise<number> {
    const templates = await prisma.certificateTemplate.findMany({
        where: {
            is_active: true,
            equipment_types: { has: equipmentType },
        },
    });
    if (templates.length === 0) return 0;

    const existing = await prisma.certificateInstance.findMany({
        where: { workpack_id: workpackId, deleted_at: null },
        select: { template_id: true },
    });
    const existingIds = new Set(existing.map((e) => e.template_id));
    let attached = 0;
    for (const t of templates) {
        if (existingIds.has(t.id)) continue;
        await prisma.certificateInstance.create({
            data: {
                organization_id: organizationId,
                workpack_id: workpackId,
                template_id: t.id,
                cert_type: t.cert_type,
                cert_name: t.cert_name,
                status: 'not_started',
                field_values: {},
                include_in_pdf: true,
            },
        });
        attached++;
    }
    return attached;
}
