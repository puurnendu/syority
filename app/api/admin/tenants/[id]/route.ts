import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const org = await prisma.organization.update({
        where: { id },
        data: {
            contract_start_date: body.contract_start_date ? new Date(body.contract_start_date) : undefined,
            contract_end_date: body.contract_end_date ? new Date(body.contract_end_date) : undefined,
            contract_value: body.contract_value ?? undefined,
            plan_tier: body.plan_tier ?? undefined,
            status: body.status ?? undefined,
            payment_status: body.payment_status ?? undefined,
            account_manager: body.account_manager ?? undefined,
            notes: body.notes ?? undefined,
            feature_flags: body.feature_flags ?? undefined,
            suspended_at: body.suspended_at ? new Date(body.suspended_at) : undefined,
            suspension_reason: body.suspension_reason ?? undefined,
        },
    });

    return NextResponse.json(org);
}
