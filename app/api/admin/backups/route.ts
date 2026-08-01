/**
 * M7.6G.1 — Backup API
 *
 * GET  /api/admin/backups — List + stats
 * POST /api/admin/backups — Create / verify / restore / enforce-retention
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupService } from '@/core/Platform/BackupService';
import { hasPermission } from '@/lib/permissions';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) return null;
  return session.user as any;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const result = await backupService.list({
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
  });

  const stats = await backupService.getStats();
  return NextResponse.json({ ...result, stats });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const action = body.action ?? 'create';

  switch (action) {
    case 'create': {
      const result = await backupService.createBackup({
        name: body.name,
        type: body.type,
        scope: body.scope,
        compression: body.compression,
        notes: body.notes,
        retentionDays: body.retentionDays,
      }, user.id);
      return NextResponse.json(result, { status: 201 });
    }

    case 'verify': {
      if (!body.backupId) return NextResponse.json({ error: 'backupId required' }, { status: 422 });
      const result = await backupService.verify(body.backupId);
      return NextResponse.json(result);
    }

    case 'restore': {
      if (!body.backupId) return NextResponse.json({ error: 'backupId required' }, { status: 422 });
      const result = await backupService.restore(body.backupId, body.scope, user.id);
      return NextResponse.json(result);
    }

    case 'preview': {
      if (!body.backupId) return NextResponse.json({ error: 'backupId required' }, { status: 422 });
      const preview = await backupService.previewRestore(body.backupId);
      return NextResponse.json(preview);
    }

    case 'enforce-retention': {
      const expired = await backupService.enforceRetention();
      return NextResponse.json({ expired });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
