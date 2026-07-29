import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DocumentIntelligenceService } from '@/core/workpack-intelligence';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('workpacks.create');
  if (error) return error;
  const { userId } = orgScope(session!);
  const { id } = await params;

  const result = await DocumentIntelligenceService.autoAttachDocuments(id, userId);
  return NextResponse.json({ data: result });
}
