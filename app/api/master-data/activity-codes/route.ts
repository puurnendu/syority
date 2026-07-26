import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/master-data/activity-codes
 * Returns activity library items for "From Library" modal.
 * Query: search, discipline, limit (default 100).
 */
export async function GET(req: NextRequest) {
    const orgId = await getOrgIdFromRequest(req);
    if (!orgId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? '';
    const discipline = searchParams.get('discipline') ?? '';
    const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100)
    );

    const where: {
        organization_id: string;
        deleted_at: null;
        is_active?: boolean;
        OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>;
        discipline?: { code: string };
    } = {
        organization_id: orgId,
        deleted_at: null,
    };
    if (search.trim()) {
        where.OR = [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { description: { contains: search.trim(), mode: 'insensitive' } },
        ];
    }
    if (discipline) {
        where.discipline = { code: discipline };
    }

    const items = await prisma.activityLibrary.findMany({
        where,
        include: { discipline: true },
        orderBy: { name: 'asc' },
        take: limit,
    });

    const codes = items.map((item) => ({
        id: item.id,
        code: item.name,
        description: item.description ?? '',
        primary_discipline: item.discipline?.code ?? item.discipline?.name ?? '',
        discipline: item.discipline?.code ?? item.discipline?.name ?? '',
        default_duration_hours: item.duration_hours
            ? Number(item.duration_hours)
            : null,
        discipline_id: item.discipline_id ?? undefined,
    }));

    return NextResponse.json({ codes });
}
