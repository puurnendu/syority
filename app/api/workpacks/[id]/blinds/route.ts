import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { BlindService } from '@/modules/Blinds/Services/BlindService';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const [blinds, summary] = await Promise.all([
            prisma.blind.findMany({
                where: { workpack_id: id, organization_id: orgId, deleted_at: null },
                orderBy: { blind_number: 'asc' },
            }),
            BlindService.getSummary(id, orgId),
        ]);
        return NextResponse.json({ data: blinds, meta: { summary } });
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
        if (action === 'confirm-isolation') {
            return NextResponse.json({ data: await BlindService.confirmIsolation(data.id, orgId, userId) });
        }
        if (action === 'insert') {
            return NextResponse.json({ data: await BlindService.recordInsert(data.id, orgId, userId) });
        }
        if (action === 'pressure-test') {
            return NextResponse.json({ data: await BlindService.recordPressureTest(data.id, orgId, userId, data.test_pressure, data.test_result) });
        }
        if (action === 'remove') {
            return NextResponse.json({ data: await BlindService.recordRemove(data.id, orgId, userId) });
        }

        const blind = await BlindService.createBlind({
            ...data, workpack_id: id, organization_id: wp.organization_id, site_id: wp.site_id, created_by: userId,
        });
        const { generateBlindMaterialLines } = await import('@/lib/materials/materialLineGenerator');
        await generateBlindMaterialLines(
            blind.id, id, wp.organization_id,
            (blind as any).flange_size ?? data.size,
            (blind as any).rating ?? data.rating
        ).catch((e) => console.error('[Materials] Blind line gen failed:', (e as Error).message));
        return NextResponse.json({ data: blind }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
