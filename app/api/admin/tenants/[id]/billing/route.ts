import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { prisma } from '@/lib/prisma';

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body?.amount || !body?.payment_date) {
        return NextResponse.json(
            { error: 'amount and payment_date required' },
            { status: 400 }
        );
    }

    const user = session!.user as any;
    const log = await prisma.billingLog.create({
        data: {
            organization_id: id,
            recorded_by: user.email ?? 'admin',
            payment_date: new Date(body.payment_date),
            amount: parseFloat(String(body.amount)),
            currency: body.currency ?? 'USD',
            reference: body.reference ?? null,
            notes: body.notes ?? null,
        },
    });

    await prisma.organization.update({
        where: { id },
        data: {
            payment_status: 'active',
            last_payment_date: new Date(body.payment_date),
            last_payment_amount: parseFloat(String(body.amount)),
        },
    });

    return NextResponse.json(log, { status: 201 });
}
