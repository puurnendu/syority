import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { PunchListService } from '@/modules/PunchList/Services/PunchListService';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const items = await prisma.punchListItem.findMany({
            where: { workpack_id: id, organization_id: orgId, deleted_at: null },
            orderBy: [{ category: 'asc' }, { created_at: 'desc' }],
            include: {
                discipline: { select: { id: true, code: true, name: true } },
                raiser: { select: { id: true, name: true } },
                assignee: { select: { id: true, name: true } },
            },
        });
        const eligibility = await PunchListService.validateClosureEligibility(id, orgId);
        return NextResponse.json({ data: items, meta: { closure_eligibility: eligibility } });
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
        if (action === 'close') {
            const item = await PunchListService.closeItem(data.id, orgId, userId, (data as { resolution_notes?: string }).resolution_notes ?? '');
            return NextResponse.json({ data: item });
        }
        if (action === 'accept') {
            const item = await PunchListService.acceptItem(data.id, orgId, userId, data.comments);
            return NextResponse.json({ data: item });
        }

        const item = await PunchListService.createItem({
            ...data,
            title: (data as { title?: string }).title ?? 'Untitled',
            workpack_id: id,
            organization_id: wp.organization_id,
            site_id: wp.site_id,
            created_by: userId,
            raised_by: userId,
        });
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
