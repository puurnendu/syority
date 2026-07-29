import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { PlantDocumentService } from '@/core/digital-plant';
import { readFile } from 'fs/promises';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('documents.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  const doc = await PlantDocumentService.getDocument(orgId, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(doc);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('documents.upload');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  const body = await req.json();
  await PlantDocumentService.updateDocument(orgId, id, body);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('documents.upload');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  try {
    await PlantDocumentService.deleteDocument(orgId, id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Delete failed' }, { status: 400 });
  }
}
