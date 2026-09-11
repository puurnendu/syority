import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const orgs = await prisma.organization.findMany({
        where: { deleted_at: null },
        include: {
            _count: {
                select: {
                    User: { where: { deleted_at: null } },
                    Workpack: { where: { deleted_at: null } },
                },
            },
        },
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(orgs);
}
