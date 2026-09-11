/**
 * M7.7.1 — Tenant Provisioning API
 *
 * POST /api/admin/tenants/provision
 *   Body: ProvisioningRequest + { mode?: 'sync' | 'async' }
 *   mode=async (default): enqueues a job, returns { jobId }
 *   mode=sync: runs synchronous provisioning (legacy), returns ProvisioningResult
 *
 * GET /api/admin/tenants/provision?check=slug&value=xxx
 * GET /api/admin/tenants/provision?check=email&value=xxx
 *   Returns: { available: boolean }
 *
 * GET /api/admin/tenants/provision?jobs=1&status=queued
 *   Returns: list of provisioning jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { tenantProvisioningService } from '@/core/Platform/TenantProvisioningService';
import { provisioningJobService } from '@/core/Platform/ProvisioningJobService';
import { provisioningWorker } from '@/core/Platform/ProvisioningWorker';

export async function POST(req: NextRequest) {
  const { session, error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const body = await req.json();

    // Inject provisionedBy from session
    body.provisionedBy = (session?.user as any)?.id;

    if (!body.provisionedBy) {
      return NextResponse.json(
        { error: 'Unable to determine provisioning user' },
        { status: 400 }
      );
    }

    const mode = body.mode ?? 'async';

    if (mode === 'async') {
      // Async provisioning — enqueue and return job ID
      const jobId = await provisioningJobService.enqueue(body, body.provisionedBy, body.templateId);

      // Ensure the worker is running to process the job
      provisioningWorker.ensureRunning();

      return NextResponse.json({ jobId, mode: 'async' }, { status: 202 });
    }

    // Sync provisioning (legacy mode)
    const result = await tenantProvisioningService.provision(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('[Tenant Provisioning] POST error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  // Job listing
  const jobsList = req.nextUrl.searchParams.get('jobs');
  if (jobsList) {
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const jobs = await provisioningJobService.listJobs(status, limit);
    return NextResponse.json(jobs);
  }

  // Slug / email availability checks
  const check = req.nextUrl.searchParams.get('check');
  const value = req.nextUrl.searchParams.get('value');

  if (!check || !value) {
    return NextResponse.json({ error: 'Missing check or value parameter' }, { status: 400 });
  }

  try {
    if (check === 'slug') {
      const available = await tenantProvisioningService.checkSlug(value);
      return NextResponse.json({ available });
    }

    if (check === 'email') {
      const available = await tenantProvisioningService.checkEmail(value);
      return NextResponse.json({ available });
    }

    return NextResponse.json({ error: 'Invalid check type. Use slug or email.' }, { status: 400 });
  } catch (err: any) {
    console.error('[Tenant Provisioning] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
