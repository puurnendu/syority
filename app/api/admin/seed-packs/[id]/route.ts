/**
 * M7.6G.1 — Seed Pack Detail API
 *
 * GET    /api/admin/seed-packs/[id] — Pack detail + executions
 * PATCH  /api/admin/seed-packs/[id] — Update
 * DELETE /api/admin/seed-packs/[id] — Delete (non-builtin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { seedPackService } from '@/core/Platform/SeedPackService';
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

  const pack = await seedPackService.get(params.id);
  if (!pack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const preview = seedPackService.preview(pack.config as any);
  return NextResponse.json({ pack, preview });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const pack = await seedPackService.update(params.id, body);
  return NextResponse.json({ pack });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await seedPackService.delete(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
