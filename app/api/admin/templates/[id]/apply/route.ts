import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WorkpackTemplateService } from '@/core/master-data/services/WorkpackTemplateService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    const { id: templateId } = await params;
    const { workpack_id } = await req.json();

    try {
        const results = await WorkpackTemplateService.applyTemplate(workpack_id, templateId, orgId, session.user.id);
        return NextResponse.json({ message: `Successfully added ${results.length} activities from template.`, activities: results });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
