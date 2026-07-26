import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { JobCompletionService } from '@/modules/certificates/services/JobCompletionService';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const orgId = session.user.organization_id!;

    const [certificate, validation] = await Promise.all([
        JobCompletionService.getCertificate(workpackId, orgId),
        JobCompletionService.validateCompletion(workpackId, orgId),
    ]);

    return NextResponse.json({ certificate, validation });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;

    try {
        const cert = await JobCompletionService.createCertificate(workpackId, session.user.organization_id!, session.user.id);
        return NextResponse.json(cert, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const body = await req.json().catch(() => ({}));

    try {
        const updated = await JobCompletionService.updateCertificate(workpackId, session.user.organization_id!, session.user.id, {
            scope_summary: body.scope_summary,
            pressure_tests_status: body.pressure_tests_status,
            materials_summary: body.materials_summary,
            lessons_learnt_summary: body.lessons_learnt_summary,
            client_name: body.client_name,
        });
        return NextResponse.json(updated);
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
    }
}
