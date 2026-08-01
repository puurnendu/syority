/**
 * M7.6G — Module Management API
 *
 * GET   /api/admin/modules — List module catalog with per-org status
 * POST  /api/admin/modules/seed — Seed module catalog
 * PATCH /api/admin/modules — Update module status for an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { moduleService, type ModuleStatus } from '@/core/Platform/ModuleService';
import { hasPermission } from '@/lib/permissions';
import { z } from 'zod';

async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) return null;
  return session.user;
}

const updateSchema = z.object({
  organizationId: z.string().uuid(),
  moduleId: z.string().uuid(),
  status: z.enum(['enabled', 'disabled', 'hidden', 'beta', 'coming_soon', 'experimental']),
});

export async function GET(req: NextRequest) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('organizationId');

  if (orgId) {
    const modules = await moduleService.getModules(orgId);
    return NextResponse.json({ modules });
  }

  const catalog = await moduleService.getModuleCatalog();
  return NextResponse.json({ catalog });
}

export async function POST(req: NextRequest) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  if (body?.action === 'seed') {
    const count = await moduleService.seedModules();
    return NextResponse.json({ seeded: count });
  }

  if (body?.action === 'initialize' && body?.organizationId) {
    const count = await moduleService.initializeForOrganization(body.organizationId);
    return NextResponse.json({ initialized: count });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await moduleService.setModuleStatus(
      parsed.data.organizationId,
      parsed.data.moduleId,
      parsed.data.status as ModuleStatus,
      (user as any).id,
    );
    return NextResponse.json({ module: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
