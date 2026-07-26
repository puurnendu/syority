import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ClearanceService } from '@/modules/checklists/services/ClearanceService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; signOffId: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { signOffId } = await params;
        const { notes } = await req.json();
        const orgId = session.user.organization_id!;

        const signOff = await ClearanceService.signOff(signOffId, orgId, session.user.id, notes);
        return NextResponse.json(signOff);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[clearance-boxup sign-off POST]', message);
        return NextResponse.json({ error: 'Failed to record sign-off', detail: message }, { status: 500 });
    }
}

