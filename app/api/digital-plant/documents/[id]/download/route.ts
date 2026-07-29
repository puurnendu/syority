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

  try {
    const buffer = await readFile(doc.storage_path);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': doc.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.original_filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }
}
