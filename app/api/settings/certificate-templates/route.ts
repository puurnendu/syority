import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const { session, error } = await guardApi('settings.templates.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    try {
        const templates = await prisma.certificate_templates.findMany({
            where: {
                OR: [{ organization_id: orgId }, { organization_id: null }],
            },
            orderBy: [{ organization_id: 'asc' }, { cert_name: 'asc' }],
        });
        return NextResponse.json(templates);
    } catch (error) {
        console.error('[certificate-templates GET]', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(req: Request) {
    const { session, error } = await guardApi('settings.templates.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const body = await req.json().catch(() => null);
    if (!body?.cert_name?.trim() || !body?.cert_type?.trim()) {
        return NextResponse.json(
            { error: 'cert_name and cert_type are required' },
            { status: 400 }
        );
    }

    try {
        const { randomUUID } = await import('crypto');
        const template = await prisma.certificate_templates.create({
            data: {
                id: randomUUID(),
                organization_id: orgId,
                cert_name: body.cert_name.trim(),
                cert_type: body.cert_type.trim(),
                equipment_types: body.equipment_types ?? [],
                fields: (body.fields ?? []) as object[],
                is_active: true,
                is_platform: false,
                version: 1,
                updated_at: new Date(),
            },
        });
        return NextResponse.json(template, { status: 201 });
    } catch (error) {
        console.error('[certificate-templates POST]', error);
        return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }
}
