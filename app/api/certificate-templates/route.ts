import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id as string;
    const url = new URL(req.url);
    const equipment_type = url.searchParams.get('equipment_type');

    const where: any = {
        is_active: true,
        OR: [{ organization_id: orgId }, { organization_id: null }],
    };
    if (equipment_type) where.equipment_types = { has: equipment_type };

    const templates = await prisma.certificate_templates.findMany({
        where,
        orderBy: { cert_name: 'asc' },
    });
    return NextResponse.json(templates);
}
