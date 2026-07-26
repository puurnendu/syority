import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { readFile } from 'fs/promises';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('documents.view');
  if (error) return error;
  const { orgId } = orgScope(session);

  const params = await context.params;

  const doc = await prisma.docLibrary.findUnique({ where: { id: params.id } });
  // Tenant isolation: only documents belonging to the caller's organization
  // (or proxied organization for platform admins) are served. 404 — not 403 —
  // so cross-tenant existence is not leaked.
  if (!doc || doc.org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.docLibrary.update({
    where: { id: params.id },
    data:  { downloads: { increment: 1 } },
  });

  let buffer: Buffer;
  try {
    buffer = await readFile(doc.storage_path);
  } catch {
    return NextResponse.json({ error: 'File missing from storage' }, { status: 404 });
  }

  const filename = encodeURIComponent(doc.original_name);
  const inline   = new URL(req.url).searchParams.get('inline') === '1';

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        doc.mime_type ?? 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control':       'private, no-store',
    },
  });
}
