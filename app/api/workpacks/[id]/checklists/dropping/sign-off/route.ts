import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DroppingBoxupService } from '@/modules/checklists/services/DroppingBoxupService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: workpackId } = await params;
    const { role } = await req.json();
    const orgId = session.user.organization_id!;

    const checklist = await DroppingBoxupService.getChecklist(workpackId, orgId);
    if (!checklist) return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });

    await DroppingBoxupService.addSignOff(checklist.id, orgId, role, session.user.id);
    return NextResponse.json({ success: true });
}
