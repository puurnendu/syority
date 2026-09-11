import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const data = await req.json();
    const party = await prisma.org_clearance_parties.update({
        where: { id, organization_id: session.user.organization_id! },
        data
    });
    return NextResponse.json(party);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await prisma.org_clearance_parties.delete({
        where: { id, organization_id: session.user.organization_id! }
    });
    return NextResponse.json({ success: true });
}
