/**
 * M7.6G.1 — Backup Detail API
 *
 * GET    /api/admin/backups/[id] — Detail + restores
 * DELETE /api/admin/backups/[id] — Delete backup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupService } from '@/core/platform/BackupService';
import { hasPermission } from '@/lib/permissions';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) return null;
  return session.user;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const backup = await backupService.get(params.id);
  if (!backup) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ backup });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await backupService.delete(params.id);
  return NextResponse.json({ success: true });
}
