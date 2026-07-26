import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { DisciplineService } from '@/core/master-data/services/DisciplineService';

/** GET /api/master-data/disciplines — list disciplines for current org (e.g. for workpack create). */
export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('workpacks.create');
    if (error) return error;
    const user = session!.user as { organization_id: string };
    const orgId = user.organization_id;
    try {
        const list = await DisciplineService.getAll(orgId);
        return NextResponse.json({ disciplines: list });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
