import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DroppingBoxupService } from '@/modules/checklists/services/DroppingBoxupService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const checklist = await DroppingBoxupService.getChecklist(workpackId, session.user.organization_id!);
    return NextResponse.json(checklist || null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id: workpackId } = await params;
        const checklist = await DroppingBoxupService.createChecklist(workpackId, session.user.organization_id!, session.user.id);
        return NextResponse.json(checklist ?? {}, { status: 201 });
    } catch (error: any) {
        console.error('[POST checklists/dropping] Error:', error);
        return NextResponse.json(
            { error: error?.message ?? 'Failed to create checklist' },
            { status: 500 }
        );
    }
}
