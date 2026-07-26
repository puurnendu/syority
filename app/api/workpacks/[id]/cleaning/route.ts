import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CleaningService } from '@/modules/checklists/services/CleaningService';
import { CleaningMethod } from '@prisma/client';

const VALID_METHODS = Object.values(CleaningMethod) as string[];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const records = await CleaningService.getRecords(workpackId, session.user.organization_id!);
    return NextResponse.json(records);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id: workpackId } = await params;
        const body = await req.json().catch(() => ({}));

        const method = body.cleaning_method as string | undefined;
        if (!method || !VALID_METHODS.includes(method)) {
            return NextResponse.json({ error: `cleaning_method must be one of: ${VALID_METHODS.join(', ')}` }, { status: 400 });
        }

        const record = await CleaningService.createRecord({
            workpack_id: workpackId,
            cleaning_method: method as CleaningMethod,
            certificate_number: body.certificate_number ?? null,
            cleaning_medium: body.cleaning_medium ?? null,
            before_condition: body.before_condition ?? null,
            after_condition: body.after_condition ?? null,
            notes: body.notes ?? null,
        }, session.user.organization_id!, session.user.id);
        return NextResponse.json(record, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
