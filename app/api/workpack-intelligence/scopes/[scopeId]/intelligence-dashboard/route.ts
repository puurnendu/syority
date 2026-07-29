import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackIntelligenceService } from '@/core/workpack-intelligence';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ scopeId: string }> }) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { scopeId } = await params;

  const result = await WorkpackIntelligenceService.getDashboard(orgId, scopeId);
  return NextResponse.json({ data: result });
}
