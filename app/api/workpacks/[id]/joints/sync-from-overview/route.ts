import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id: workpackId } = await params;
        const orgId = session.user?.organization_id;

        await assertTenantAccess('workpack', workpackId, orgId);

        const wp = await prisma.workpack.findUnique({
            where: { id: workpackId, organization_id: orgId },
            select: { equipment_technical_data: true, asset: { select: { tag_number: true } } },
        });

        if (!wp) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        const techData = typeof wp.equipment_technical_data === 'object' && wp.equipment_technical_data !== null
            ? (wp.equipment_technical_data as Record<string, any>)
            : {};

        const nozzles = Array.isArray(techData.nozzles) ? techData.nozzles : [];
        if (nozzles.length === 0) {
            return NextResponse.json({ nozzles: [] });
        }

        const tag = wp.asset?.tag_number ? `${wp.asset.tag_number}-` : '';
        const mapped = nozzles.map((n: any, idx: number) => {
            const mark = typeof n.mark === 'string' ? n.mark.trim() : `N${idx + 1}`;
            return {
                id: `nozzle-${idx}`,
                mark,
                location: `${n.service || n.description || 'Nozzle'} ${mark}`.trim(),
                size: n.size || n.nb || n.nominal_size || null,
                rating: n.rating || n.class || n.pressure_rating || null,
                flange_type: n.type || n.facing || n.flange_type || null,
                jointNo: `J-${tag}${mark}`,
                blindNo: `BL-${tag}${mark}`,
            };
        });

        return NextResponse.json({ nozzles: mapped });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id: workpackId } = await params;
        const orgId = session.user?.organization_id;
        const userId = session.user?.id;

        await assertTenantAccess('workpack', workpackId, orgId);
        
        const wp = await prisma.workpack.findUnique({
            where: { id: workpackId, organization_id: orgId },
            select: { site_id: true }
        });
        if (!wp) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        const body = await req.json();
        const { joints, blinds } = body as { joints: any[]; blinds: any[] };

        let jointsCreated = 0;
        let blindsCreated = 0;

        if (joints && Array.isArray(joints)) {
            // deduplicate
            const existingJoints = await prisma.jointIntegrityItem.findMany({
                where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null },
                select: { joint_number: true },
            });
            const set = new Set(existingJoints.map(j => j.joint_number));

            for (const j of joints) {
                if (!j.jointNo || set.has(j.jointNo)) continue;
                await prisma.jointIntegrityItem.create({
                    data: {
                        workpack_id: workpackId,
                        organization_id: orgId,
                        site_id: wp.site_id,
                        joint_number: j.jointNo,
                        location: j.location || null,
                        flange_size: j.size || null,
                        rating: j.rating || null,
                        flange_type: j.flange_type || null,
                        status: 'pending',
                        ai_generated: true,
                        created_by: userId || undefined,
                        updated_by: userId || undefined,
                    }
                });
                set.add(j.jointNo);
                jointsCreated++;
            }
        }

        if (blinds && Array.isArray(blinds)) {
            const existingBlinds = await prisma.blind.findMany({
                where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null },
                select: { blind_number: true },
            });
            const set = new Set(existingBlinds.map(b => b.blind_number));

            for (const b of blinds) {
                if (!b.blindNo || set.has(b.blindNo)) continue;
                // Blind model doesn't have ai_generated, but we can set basic properties
                await prisma.blind.create({
                    data: {
                        workpack_id: workpackId,
                        organization_id: orgId,
                        site_id: wp.site_id,
                        blind_number: b.blindNo,
                        location: b.location || null,
                        size: b.size || null,
                        pressure_rating: b.rating || null,
                        status: 'pending',
                        created_by: userId || undefined,
                        updated_by: userId || undefined,
                    }
                });
                set.add(b.blindNo);
                blindsCreated++;
            }
        }

        return NextResponse.json({ success: true, jointsCreated, blindsCreated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
