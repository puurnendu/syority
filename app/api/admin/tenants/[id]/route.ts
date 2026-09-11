import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { prisma } from '@/lib/prisma';
import { tenantLifecycleService } from '@/core/Platform/TenantLifecycleService';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
    const { error, session } = await guardPlatformApi('nav.admin');
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

/**
 * M7.7.1 — Lifecycle transitions.
 * POST /api/admin/tenants/:id { action: 'activate' | 'suspend' | 'archive' | 'restore' | 'delete', reason? }
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
    const { error, session } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body?.action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

    const operatorId = (session as any)?.user?.id;
    if (!operatorId) return NextResponse.json({ error: 'No operator ID' }, { status: 403 });

    const actionMap: Record<string, () => Promise<any>> = {
        activate: () => tenantLifecycleService.activate(id, operatorId),
        suspend: () => tenantLifecycleService.suspend(id, operatorId, body.reason),
        archive: () => tenantLifecycleService.archive(id, operatorId),
        restore: () => tenantLifecycleService.restore(id, operatorId),
        delete: () => tenantLifecycleService.softDelete(id, operatorId),
        expire: () => tenantLifecycleService.expire(id, operatorId),
    };

    const handler = actionMap[body.action];
    if (!handler) {
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    try {
        const result = await handler();
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, action: body.action });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
