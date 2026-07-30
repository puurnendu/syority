/**
 * M7.6G.1 — Installation API
 *
 * GET  /api/install — Status
 * POST /api/install — Execute installation
 */

import { NextRequest, NextResponse } from 'next/server';
import { installationService } from '@/core/platform/InstallationService';
import { z } from 'zod';

const installSchema = z.object({
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  orgName: z.string().optional(),
  orgSlug: z.string().optional(),
  seedPackSlug: z.string().optional(),
});

export async function GET() {
  const status = await installationService.getStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  // Check if already installed — prevent re-installation
  const status = await installationService.getStatus();
  if (status.isInstalled) {
    return NextResponse.json({ error: 'Platform is already installed' }, { status: 400 });
  }

  const body = await req.json();

  if (body.action === 'report') {
    const report = await installationService.generateReport();
    return NextResponse.json(report);
  }

  const parsed = installSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  const result = await installationService.install(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
