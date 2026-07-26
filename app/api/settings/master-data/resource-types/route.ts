import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const orgId = user.organization_id;

    try {
        const types = await prisma.resourceType.findMany({
            where: { organization_id: orgId },
            include: { discipline: true },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(types);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
