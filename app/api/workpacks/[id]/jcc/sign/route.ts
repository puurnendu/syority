import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { JobCompletionService } from '@/modules/certificates/services/JobCompletionService';

const VALID_ROLES = ['maint_engineer', 'operations', 'qa', 'client'] as const;

/**
 * POST /api/workpacks/[id]/jcc/sign
 * Body: { role: 'maint_engineer' | 'operations' | 'qa' | 'client' }
 * Records the current user's sign-off in the appropriate field on the JCC.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const body = await req.json().catch(() => ({}));

    const role = body.role as string;
    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
        return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    try {
        const updated = await JobCompletionService.signCertificate(
            workpackId,
            session.user.organization_id!,
            session.user.id,
            role as typeof VALID_ROLES[number]
        );
        return NextResponse.json(updated);
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Sign failed' }, { status: 400 });
    }
}
