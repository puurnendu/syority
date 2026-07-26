import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { unlink } from 'fs/promises';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('documents.upload');
  if (error) return error;
  const user = session!.user as any;
  const { orgId } = orgScope(session);
  const params = await context.params;

  const doc = await prisma.docLibrary.findUnique({ where: { id: params.id } });
  // Tenant isolation — 404 for cross-tenant ids
  if (!doc || doc.org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Only uploader or super admin can delete
  const canDelete = user.is_super_admin || user.role === 'SUPER_ADMIN' || doc.uploaded_by === user.id;
  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try { await unlink(doc.storage_path); } catch {}
  await prisma.docLibrary.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
