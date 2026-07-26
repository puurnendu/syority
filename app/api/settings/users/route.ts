import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { getOrgScope } from '@/lib/orgScope';
import { UserService } from '@/core/tenant/services/UserService';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('settings.users.view');
    if (error) return error;
    try {
        const { orgId } = getOrgScope(session!);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || undefined;
        const page = Number(searchParams.get('page') || 1);
        const pageSize = Number(searchParams.get('pageSize') || 25);
        const activeParam = searchParams.get('is_active');
        const is_active =
            activeParam === 'true' ? true : activeParam === 'false' ? false : null;

        const result = await UserService.list(orgId, { search, page, pageSize, is_active });
        return NextResponse.json(result);
    } catch (err: any) {
        if (err?.message === 'No organization in session') {
            return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
        }
        console.error('[GET /api/settings/users]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { session, error } = await guardApi('settings.users.edit');
    if (error) return error;
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const errors: string[] = [];
    if (!body.name?.trim()) errors.push('Full name is required');
    if (!body.email?.trim()) errors.push('Email is required');
    if (!body.password?.trim()) errors.push('Password is required');
    if (body.password?.trim() && body.password.length < 8) errors.push('Password must be at least 8 characters');
    if (errors.length > 0) {
        return NextResponse.json({ error: errors.join('. ') }, { status: 400 });
    }

    try {
        const { orgId, userId, isSuperAdmin } = getOrgScope(session!);
        const targetOrgId =
            isSuperAdmin && body.organization_id && String(body.organization_id).trim()
                ? String(body.organization_id).trim()
                : orgId;
        if (targetOrgId !== orgId) {
            const { prisma } = await import('@/lib/prisma');
            const targetOrg = await prisma.organization.findFirst({
                where: { id: targetOrgId, deleted_at: null },
            });
            if (!targetOrg) {
                return NextResponse.json({ error: 'Target organization not found' }, { status: 400 });
            }
        }
        const newUser = await UserService.create(targetOrgId, body, userId!);
        return NextResponse.json(newUser, { status: 201 });
    } catch (err: any) {
        if (err?.message === 'No organization in session') {
            return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
        }
        const code = err?.code;
        if (code === 'P2002') {
            return NextResponse.json(
                { error: 'A user with this email already exists' },
                { status: 409 }
            );
        }
        if (code === 'P2003') {
            return NextResponse.json(
                { error: 'Invalid reference (e.g. site or role not found)' },
                { status: 422 }
            );
        }
        console.error('[POST /api/settings/users]', err);
        return NextResponse.json(
            { error: err?.message ?? 'Failed to create user' },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    const { session, error } = await guardApi('settings.users.edit');
    if (error) return error;

    let orgId: string;
    let userId: string | undefined;
    try {
        const scope = getOrgScope(session!);
        orgId = scope.orgId;
        userId = scope.userId;
    } catch {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { id, ...data } = body;
    if (!id) {
        return NextResponse.json({ error: 'User id is required for update' }, { status: 400 });
    }

    try {
        const updated = await UserService.update(id, orgId, data, userId!);
        return NextResponse.json(updated);
    } catch (err: any) {
        if (err?.message === 'No organization in session') {
            return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
        }
        if (err?.message === 'User not found') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (err?.message === 'Password must be at least 8 characters') {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        const code = err?.code;
        if (code === 'P2002') {
            return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
        }
        if (code === 'P2003') {
            return NextResponse.json({ error: 'Invalid reference (e.g. site or role not found)' }, { status: 422 });
        }
        console.error('[PUT /api/settings/users]', err);
        return NextResponse.json({ error: err?.message ?? 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { session, error } = await guardApi('settings.users.edit');
    if (error) return error;

    let orgId: string;
    let userId: string | undefined;
    try {
        const scope = getOrgScope(session!);
        orgId = scope.orgId;
        userId = scope.userId;
    } catch {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    if (!id) {
        try {
            const body = await req.json();
            id = body?.id;
        } catch {
            /* no body */
        }
    }
    if (!id) {
        return NextResponse.json({ error: 'User id is required' }, { status: 400 });
    }

    try {
        await UserService.delete(id, orgId, userId!);
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        if (err?.message === 'User not found') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (err?.message === 'You cannot delete your own account') {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        console.error('[DELETE /api/settings/users]', err);
        return NextResponse.json({ error: err?.message ?? 'Failed to delete user' }, { status: 500 });
    }
}
