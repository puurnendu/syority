import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackAiService } from '@/core/workpack-intelligence';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const body = await req.json();

  const result = await WorkpackAiService.recommendTemplate(orgId, {
    assetType: body.asset_type,
    equipmentType: body.equipment_type,
    discipline: body.discipline,
    reason: body.reason,
  });

  return NextResponse.json({ data: result });
}
