import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Public list of active organizations for login tenant selector (multi-tenant). */
export async function GET() {
    const orgs = await prisma.organization.findMany({
        where: {
            deleted_at: null,
            OR: [{ is_active: true }, { is_active: null }],
        },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
    });
    return NextResponse.json(orgs);
}
