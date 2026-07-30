/**
 * M7.6C — Dashboard Clone API
 * POST — Clone a dashboard (including all widgets)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const { id } = await params;
  const body = await req.json();

  if (!body.name || !body.slug) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'name and slug are required' } },
      { status: 400 },
    );
  }

  const cloned = await DashboardService.clone(id, body.name, body.slug, userId, orgId);
  return NextResponse.json({ data: cloned }, { status: 201 });
}
