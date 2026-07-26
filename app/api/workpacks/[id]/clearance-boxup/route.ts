import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ClearanceService } from '@/modules/checklists/services/ClearanceService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id: workpackId } = await params;
        const clearance = await ClearanceService.getClearance(workpackId, session.user.organization_id!);
        return NextResponse.json(clearance ?? null);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[clearance-boxup GET]', message);
        return NextResponse.json({ error: 'Failed to load clearance', detail: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id: workpackId } = await params;
        const clearance = await ClearanceService.initializeClearance(workpackId, session.user.organization_id!, session.user.id);
        return NextResponse.json(clearance);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[clearance-boxup POST]', message);
        // Duplicate clearance: may already exist (unique constraint on workpack_id)
        if (message.includes('Unique constraint')) {
            return NextResponse.json({ error: 'Clearance already initialized for this workpack.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to initialize clearance', detail: message }, { status: 500 });
    }
}
