import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';

/**
 * Legacy admin templates API — now delegates to TemplateLibraryService.
 * Part 7: Legacy consolidation. Part 8: Security (guardApi replaces raw session).
 *
 * applyTemplate() from WorkpackTemplateService is intentionally kept as a
 * separate "merge activities" operation (distinct from "instantiate").
 */
export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('settings.templates.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    try {
        const items = await TemplateLibraryService.list({
            organizationId: orgId,
            library: 'ALL',
            status: 'ALL',
            latestOnly: true,
        });
        return NextResponse.json(Array.isArray(items) ? items : []);
    } catch (err) {
        console.error('[admin/templates GET]', err);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(req: NextRequest) {
    const { session, error } = await guardApi('settings.templates.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const userId = (session!.user as any).id;
    const body = await req.json();

    if (!body?.name?.trim() || !body?.equipment_type?.trim() || !body?.job_type?.trim()) {
        return NextResponse.json(
            { error: 'name, equipment_type, and job_type are required' },
            { status: 400 }
        );
    }

    try {
        const created = await TemplateLibraryService.createDraft({
            organizationId: orgId,
            userId,
            library_scope: body.library_scope || 'TENANT',
            name: body.name.trim(),
            equipment_type: body.equipment_type.trim(),
            job_type: body.job_type.trim(),
            category: body.category,
            equipment_class: body.equipment_class,
            discipline_id: body.discipline_id,
            description: body.description,
            sections: body,
        });
        return NextResponse.json(created, { status: 201 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Create failed' },
            { status: 400 }
        );
    }
}
