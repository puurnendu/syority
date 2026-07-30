/**
 * M7.6G.1 — Seed Packs API
 *
 * GET  /api/admin/seed-packs — List all packs
 * POST /api/admin/seed-packs — Create / Execute / Clone / Import / Seed built-ins
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { seedPackService } from '@/core/platform/SeedPackService';
import { hasPermission } from '@/lib/permissions';
import { z } from 'zod';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) return null;
  return session.user;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const packs = await seedPackService.list({
    category: searchParams.get('category') || undefined,
    status: searchParams.get('status') || undefined,
  });

  return NextResponse.json({ packs });
}

const createSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  config: z.record(z.any()),
});

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const action = body.action ?? 'create';

  switch (action) {
    case 'seed': {
      const count = await seedPackService.seedBuiltinPacks();
      return NextResponse.json({ message: `Seeded ${count} built-in packs` });
    }

    case 'execute': {
      if (!body.packId) return NextResponse.json({ error: 'packId required' }, { status: 422 });
      const result = await seedPackService.execute(body.packId, {
        slug: body.slug,
        name: body.name,
      });
      return NextResponse.json(result, { status: 201 });
    }

    case 'clone': {
      if (!body.packId || !body.newSlug) {
        return NextResponse.json({ error: 'packId and newSlug required' }, { status: 422 });
      }
      const cloned = await seedPackService.clone(body.packId, body.newSlug);
      return NextResponse.json({ pack: cloned }, { status: 201 });
    }

    case 'import': {
      if (!body.data) return NextResponse.json({ error: 'data required' }, { status: 422 });
      const imported = await seedPackService.importPack(body.data);
      return NextResponse.json({ pack: imported }, { status: 201 });
    }

    case 'preview': {
      if (!body.packId) return NextResponse.json({ error: 'packId required' }, { status: 422 });
      const pack = await seedPackService.get(body.packId);
      if (!pack) return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
      const preview = seedPackService.preview(pack.config as any);
      return NextResponse.json({ preview });
    }

    case 'create': {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
      }
      const pack = await seedPackService.create(parsed.data as any);
      return NextResponse.json({ pack }, { status: 201 });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
