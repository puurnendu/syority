import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parties = await prisma.orgClearanceParty.findMany({
        where: { organization_id: session.user.organization_id! },
        orderBy: { sequence_number: 'asc' }
    });
    return NextResponse.json(parties);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const data = await req.json();
    const party = await prisma.orgClearanceParty.create({
        data: {
            ...data,
            organization_id: session.user.organization_id!
        }
    });
    return NextResponse.json(party);
}
