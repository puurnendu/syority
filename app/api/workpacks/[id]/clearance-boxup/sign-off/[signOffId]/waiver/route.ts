import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { extractRequestMeta } from '@/lib/requestMeta';

/**
 * POST /api/workpacks/[id]/clearance-boxup/sign-off/[signOffId]/waiver
 *
 * Records a waiver on a sign-off row when a party cannot physically sign off
 * but an authorised person grants a documented waiver.
 *
 * Since ClearanceSignOff has no dedicated waiver columns, the waiver details
 * are stored as a structured token in the `notes` field:
 *   [WAIVER] reason: <reason> | authoriser: <name> | expiry: <date> | granted_by: <userId>
 *
 * The sign-off is marked `signed_by` = the authoriser's userId so the
 * completion check still passes.
 *
 * Body: { reason: string; authoriser_name: string; expiry_date?: string (ISO) }
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string; signOffId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { signOffId } = await context.params;
        const orgId = session.user.organization_id!;
        const userId = session.user.id;

        const body = await req.json().catch(() => ({}));
        const meta = extractRequestMeta(req);
        const reason = String(body.reason ?? '').trim();
        const authoriserName = String(body.authoriser_name ?? '').trim();
        const expiryDate = body.expiry_date ? String(body.expiry_date) : null;

        if (!reason) return NextResponse.json({ error: 'reason is required' }, { status: 400 });
        if (!authoriserName) return NextResponse.json({ error: 'authoriser_name is required' }, { status: 400 });

        // Verify the sign-off belongs to this org
        const existing = await prisma.clearanceSignOff.findFirst({
            where: { id: signOffId, organization_id: orgId },
        });
        if (!existing) return NextResponse.json({ error: 'Sign-off not found' }, { status: 404 });

        const waiverNote = [
            '[WAIVER]',
            `reason: ${reason}`,
            `authoriser: ${authoriserName}`,
            expiryDate ? `expiry: ${expiryDate}` : null,
            `granted_by: ${userId}`,
            `granted_at: ${new Date().toISOString()}`,
        ].filter(Boolean).join(' | ');

        const updated = await prisma.clearanceSignOff.update({
            where: { id: signOffId, organization_id: orgId },
            data: {
                signed_by: userId,
                signed_at: new Date(),
                notes: waiverNote,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            model_name: 'ClearanceSignOff',
            model_id: signOffId,
            action: 'waiver_granted',
            new_values: { reason, authoriser_name: authoriserName, expiry_date: expiryDate },
            ip_address: meta.ip,
            user_agent: meta.userAgent,
        });

        return NextResponse.json({
            ...updated,
            is_waiver: true,
            waiver: { reason, authoriser_name: authoriserName, expiry_date: expiryDate },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Waiver failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
