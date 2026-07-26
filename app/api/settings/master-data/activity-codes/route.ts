import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ActivityLibraryService } from '@/core/master-data/services/ActivityLibraryService';
import { guardApi } from '@/lib/apiGuard';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.view');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;

    try {
        const items = await prisma.activityLibrary.findMany({
            where: { organization_id: orgId, deleted_at: null },
            include: {
                discipline: true,
            },
            orderBy: { name: 'asc' },
        });
        const counts = await prisma.activity.groupBy({
            by: ['activity_library_id'],
            _count: { id: true },
            where: { activity_library_id: { not: null }, deleted_at: null },
        });
        const countMap = new Map(counts.map((c) => [c.activity_library_id, c._count.id]));
        const withUsage = items.map((item) => ({ ...item, _usageCount: countMap.get(item.id) ?? 0 }));
        return NextResponse.json(withUsage);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.activity_codes.edit');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization context required' }, { status: 403 });

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.name?.trim() && !body.description?.trim()) {
        return NextResponse.json(
            { error: 'Activity name or description is required' },
            { status: 400 }
        );
    }

    try {
        const item = await ActivityLibraryService.create(orgId, body, user.id);
        return NextResponse.json(item, { status: 201 });
    } catch (err: any) {
        console.error('[activity-codes POST]', { message: err?.message, code: err?.code, meta: err?.meta });
        if (err?.code === 'P2002') {
            return NextResponse.json(
                { error: 'An activity code with this name already exists' },
                { status: 409 }
            );
        }
        if (err?.code === 'P2012' || err?.code === 'P2019') {
            return NextResponse.json(
                { error: 'Missing required field', detail: err?.meta?.message ?? err?.message },
                { status: 422 }
            );
        }
        if (err?.code === 'P2003') {
            return NextResponse.json(
                { error: 'Referenced record not found (e.g. discipline)' },
                { status: 422 }
            );
        }
        return NextResponse.json(
            { error: err?.message ?? 'Failed to save activity code' },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.activity_codes.edit');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization context required' }, { status: 403 });

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Id is required for update' }, { status: 400 });

    try {
        const updated = await ActivityLibraryService.update(id, orgId, data, user.id);
        return NextResponse.json(updated);
    } catch (err: any) {
        if (err?.message === 'Library item not found') {
            return NextResponse.json({ error: 'Activity code not found' }, { status: 404 });
        }
        console.error('[activity-codes PUT]', { message: err?.message, code: err?.code, meta: err?.meta });
        if (err?.code === 'P2002') {
            return NextResponse.json({ error: 'An activity code with this name already exists' }, { status: 409 });
        }
        if (err?.code === 'P2003') {
            return NextResponse.json({ error: 'Referenced record not found' }, { status: 422 });
        }
        return NextResponse.json(
            { error: err?.message ?? 'Failed to update activity code' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const { session, error } = await guardApi('masterdata.activity_codes.edit');
    if (error) return error;
    const user = session!.user as any;
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization context required' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    try {
        const existing = await prisma.activityLibrary.findFirst({
            where: { id, organization_id: orgId, deleted_at: null },
        });
        if (!existing) return NextResponse.json({ error: 'Activity code not found' }, { status: 404 });

        await prisma.activityLibrary.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'Delete failed' }, { status: 500 });
    }
}
