import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { ExecutionWriteService } from '@/core/execution/ExecutionWriteService';
import { mapTargetStatusToAction } from '@/core/execution/executionFieldGuard';
import type { ExecutionActionParams } from '@/core/execution/ExecutionWriteService';

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const userId = session!.user.id;
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body?.ids?.length || !body.updates) {
        return NextResponse.json(
            { error: 'ids and updates are required' },
            { status: 400 }
        );
    }

    const workpack = await prisma.workpack.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
        select: { id: true, event_id: true },
    });
    if (!workpack) {
        return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });
    }

    const valid = await prisma.activity.findMany({
        where: {
            id: { in: body.ids as string[] },
            workpack_id: id,
            organization_id: orgId,
            deleted_at: null,
        },
        select: { id: true, status: true, event_id: true },
    });
    const validIds = valid.map((a) => a.id);

    if (validIds.length === 0) {
        return NextResponse.json({ error: 'No valid activities found' }, { status: 404 });
    }

    const wantsExecution =
        body.updates.status !== undefined || body.updates.progress_percent !== undefined;
    const wantsPlanning = body.updates.discipline !== undefined;

    if (wantsExecution) {
        const paramsList: ExecutionActionParams[] = [];
        const mappingErrors: { activityId: string; error: string }[] = [];

        for (const row of valid) {
            if (body.updates.status !== undefined) {
                const mapped = mapTargetStatusToAction(String(body.updates.status), row.status || 'not_started');
                if ('error' in mapped) {
                    mappingErrors.push({ activityId: row.id, error: mapped.error });
                    continue;
                }
                paramsList.push({
                    activityId: row.id,
                    action: mapped.action,
                    progress: body.updates.progress_percent !== undefined
                        ? Number(body.updates.progress_percent)
                        : undefined,
                    hold_reason: mapped.action === 'HOLD' ? 'Bulk hold from workpack activities' : undefined,
                });
            } else if (body.updates.progress_percent !== undefined) {
                paramsList.push({
                    activityId: row.id,
                    action: 'UPDATE_PROGRESS',
                    progress: Math.min(100, Math.max(0, Number(body.updates.progress_percent))),
                });
            }
        }

        const results = paramsList.length
            ? await ExecutionWriteService.bulkApplyAction(orgId, userId, paramsList, {
                source_channel: 'web',
                eventId: workpack.event_id ?? undefined,
              })
            : [];

        const failed = [
            ...mappingErrors.map((e) => ({ activityId: e.activityId, success: false as const, error: e.error })),
            ...results.filter((r) => !r.success),
        ];
        const succeeded = results.filter((r) => r.success).length;

        if (wantsPlanning) {
            await prisma.activity.updateMany({
                where: { id: { in: validIds }, organization_id: orgId },
                data: { discipline_id: body.updates.discipline },
            });
        }

        return NextResponse.json({
            updated: succeeded,
            skipped: body.ids.length - validIds.length,
            failed: failed.length,
            results: [...results, ...mappingErrors.map((e) => ({ activityId: e.activityId, success: false, error: e.error }))],
        });
    }

    const data: Record<string, unknown> = {};
    if (body.updates.discipline !== undefined) data.discipline_id = body.updates.discipline;

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'No valid planning fields to update' }, { status: 400 });
    }

    await prisma.activity.updateMany({
        where: { id: { in: validIds }, organization_id: orgId },
        data,
    });

    return NextResponse.json({
        updated: validIds.length,
        skipped: body.ids.length - validIds.length,
    });
}
