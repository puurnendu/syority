import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { WorkpackAiService } from '@/core/workpack-intelligence';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  const { id } = await params;

  const result = await WorkpackAiService.identifyMissingData(id);
  return NextResponse.json({ data: result });
}
