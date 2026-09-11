/**
 * M7.7.1 — Provisioning Templates API
 * CRUD for provisioning templates + seed built-in templates.
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { provisioningTemplateService } from '@/core/Platform/ProvisioningTemplateService';

export async function GET() {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const templates = await provisioningTemplateService.list();
    return NextResponse.json(templates);
}

export async function POST(req: Request) {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    // Special action: seed built-in templates
    if (body.action === 'seed') {
        const count = await provisioningTemplateService.seedBuiltinTemplates();
        return NextResponse.json({ seeded: count });
    }

    // Create custom template
    if (!body.slug || !body.name) {
        return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
    }

    try {
        const template = await provisioningTemplateService.create(body);
        return NextResponse.json(template, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
