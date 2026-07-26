import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import type { TighteningMethod, JointStatus } from '@prisma/client';
import type { ExtractedJoint } from '@/lib/ai/jointExtraction';
import { ItemMatchingService } from '@/services/master-data/ItemMatchingService';

function mapTighteningMethod(s: string | null | undefined): TighteningMethod | undefined {
    if (!s) return undefined;
    const v = s.toLowerCase();
    if (v.includes('tension')) return 'tensioning';
    if (v.includes('hand') || v.includes('manual')) return 'manual';
    return 'torque';
}

function mapStatus(s: string | null | undefined): JointStatus {
    if (!s) return 'pending';
    const v = s.toLowerCase();
    if (v === 'assembled' || v === 'closed') return 'assembled';
    if (v === 'inspected' || v === 'tested') return 'inspected';
    if (v === 'signed_off') return 'signed_off';
    if (v === 'dismantled') return 'dismantled';
    return 'pending';
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: workpackId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(req);

        const wp = await prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId },
            select: { id: true, organization_id: true, site_id: true },
        });
        if (!wp) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        const body = await req.json();
        const joints = (body.joints ?? []) as ExtractedJoint[];
        const skipDuplicates = !!body.skipDuplicates;

        const existing = await prisma.jointIntegrityItem.findMany({
            where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null },
            select: { joint_number: true },
        });
        const existingSet = new Set(existing.map((j) => j.joint_number));

        const created: { id: string; joint_number: string }[] = [];
        for (const j of joints) {
            const jointNo = (j.jointNo ?? '').trim();
            if (!jointNo) continue;
            if (skipDuplicates && existingSet.has(jointNo)) continue;

            const tighteningMethod = mapTighteningMethod(j.tighteningMethod);
            // Match Gasket and Bolts with Master Consumable List
            const { item: gasketItem } = await ItemMatchingService.matchOrCreateItem(wp.organization_id, {
                description: `Gasket: ${j.gasketMaterial ?? 'Spiral Wound'} ${j.size ?? ''} ${j.flangeRating ?? ''}`.trim(),
                size: j.size,
                rating: j.flangeRating,
                category: 'gasket'
            });

            const { item: boltItem } = await ItemMatchingService.matchOrCreateItem(wp.organization_id, {
                description: `Bolt: ${j.boltSpec ?? 'A193 B7'} ${j.size ?? ''}`.trim(),
                size: j.size,
                category: 'bolt'
            });

            const record = await prisma.jointIntegrityItem.create({
                data: {
                    workpack_id: workpackId,
                    organization_id: wp.organization_id,
                    site_id: wp.site_id ?? '',
                    joint_number: jointNo,
                    line_number: j.lineNumber ?? null,
                    specification: j.pipeSpec ?? null,
                    rating: j.flangeRating ?? null,
                    flange_size: j.size ?? null,
                    location: j.location ?? null,
                    flange_type: j.gasketType ?? null,
                    gasket_material: j.gasketMaterial ?? null,
                    bolt_reference_standard: j.boltSpec ?? null,
                    tightening_method: tighteningMethod ?? undefined,
                    torque_tightening_value: j.torqueValue != null && !isNaN(j.torqueValue) ? j.torqueValue : undefined,
                    status: mapStatus(j.status),
                    ai_generated: true,
                    created_by: userId ?? undefined,
                    updated_by: userId ?? undefined,
                    gasket_item_id: gasketItem.id,
                    bolt_item_id: boltItem.id
                },
            });
            created.push({ id: record.id, joint_number: record.joint_number });
            existingSet.add(jointNo);
        }

        return NextResponse.json({ data: created, count: created.length }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
