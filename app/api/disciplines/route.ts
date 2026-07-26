import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const disciplines = await prisma.discipline.findMany({
            where: { organization_id: orgId, is_active: true },
            select: { id: true, name: true, code: true, color: true },
            orderBy: { code: 'asc' },
        });

        return NextResponse.json({ data: disciplines });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
