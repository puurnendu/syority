/**
 * M7.7.1 — Provisioning Job API (per-job operations)
 *
 * GET  /api/admin/tenants/provision/:jobId       → Job progress + logs
 * POST /api/admin/tenants/provision/:jobId       → cancel | retry | resume | rollback | force_complete
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { provisioningJobService } from '@/core/Platform/ProvisioningJobService';

export async function GET(
    _req: Request,
    context: { params: Promise<{ jobId: string }> },
) {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const { jobId } = await context.params;

    const progress = await provisioningJobService.getProgress(jobId);
    if (!progress) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(progress);
}

export async function POST(
    req: Request,
    context: { params: Promise<{ jobId: string }> },
) {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const { jobId } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body?.action) {
        return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const actions: Record<string, () => Promise<void>> = {
        cancel: () => provisioningJobService.cancel(jobId),
        retry: () => provisioningJobService.retry(jobId),
        resume: () => provisioningJobService.resume(jobId),
        rollback: () => provisioningJobService.rollback(jobId),
        force_complete: () => provisioningJobService.forceComplete(jobId),
    };

    const handler = actions[body.action];
    if (!handler) {
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    try {
        await handler();
        return NextResponse.json({ success: true, action: body.action });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
