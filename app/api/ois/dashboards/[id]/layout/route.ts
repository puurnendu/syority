/**
 * M7.6C — Batch Layout Update API
 * POST — Update multiple widget positions in one call (after drag-drop)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  if (!Array.isArray(body.layouts)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'layouts array is required' } },
      { status: 400 },
    );
  }

  await DashboardService.batchUpdateLayout(id, body.layouts);
  return NextResponse.json({ data: { updated: body.layouts.length } });
}
