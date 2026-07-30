/**
 * M7.6G — License Management API
 *
 * GET  /api/admin/licenses — List all licenses
 * POST /api/admin/licenses — Create a license for an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { licenseService, type LicenseType } from '@/core/platform/LicenseService';
import { hasPermission } from '@/lib/permissions';
import { z } from 'zod';

async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) return null;
  return session.user;
}

const createSchema = z.object({
  organizationId: z.string().uuid(),
  licenseType: z.enum(['trial', 'beta', 'starter', 'professional', 'enterprise', 'unlimited', 'custom']),
  expiresAt: z.coerce.date().optional(),
  gracePeriodDays: z.number().int().min(0).max(90).optional(),
  limits: z.record(z.number().int().min(0)).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as LicenseType | null;
  const status = searchParams.get('status') as any;

  const licenses = await licenseService.listLicenses({
    type: type || undefined,
    status: status || undefined,
  });

  const stats = await licenseService.getStats();

  return NextResponse.json({ licenses, stats });
}

export async function POST(req: NextRequest) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const license = await licenseService.createLicense({
      ...parsed.data,
      createdBy: (user as any).id,
    });
    return NextResponse.json({ license }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
