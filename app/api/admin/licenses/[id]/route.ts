/**
 * M7.6G — License Detail API
 *
 * GET   /api/admin/licenses/[id] — Get license details + usage summary
 * PATCH /api/admin/licenses/[id] — Update license limits/status/expiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { licenseService } from '@/core/platform/LicenseService';
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
  license_type: z.enum(['trial', 'beta', 'starter', 'professional', 'enterprise', 'unlimited', 'custom']).optional(),
  status: z.enum(['active', 'suspended', 'expired', 'revoked', 'grace']).optional(),
  expires_at: z.coerce.date().nullable().optional(),
  grace_period_days: z.number().int().min(0).max(90).optional(),
  max_users: z.number().int().min(0).optional(),
  max_shutdowns: z.number().int().min(0).optional(),
  max_projects: z.number().int().min(0).optional(),
  max_storage_gb: z.number().int().min(0).optional(),
  max_documents: z.number().int().min(0).optional(),
  max_reports: z.number().int().min(0).optional(),
  max_dashboards: z.number().int().min(0).optional(),
  max_scheduled_reports: z.number().int().min(0).optional(),
  max_ai_credits: z.number().int().min(0).optional(),
  max_api_calls_daily: z.number().int().min(0).optional(),
  max_bg_jobs_daily: z.number().int().min(0).optional(),
  max_emails_monthly: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  // Try to find by license ID first, then by org ID
  let license = await licenseService.getLicense(id);
  if (!license) {
    // Maybe `id` is the org ID
    const byOrg = await licenseService.getLicense(id);
    if (byOrg) license = byOrg;
  }

  if (!license) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  const usage = await licenseService.getUsageSummary(license.organization_id);

  return NextResponse.json({ license, usage });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const license = await licenseService.updateLicense(id, parsed.data as any);
    return NextResponse.json({ license });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
