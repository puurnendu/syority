import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WorkpackTemplateService } from '@/core/master-data/services/WorkpackTemplateService';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    try {
        const templates = await WorkpackTemplateService.getTemplates(orgId);
        return NextResponse.json(Array.isArray(templates) ? templates : []);
    } catch (error) {
        console.error('[admin/templates GET]', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    const data = await req.json();
    const created = await WorkpackTemplateService.createTemplate({
        ...data,
        organization_id: orgId,
        created_by: session.user.id
    });
    return NextResponse.json(created);
}
