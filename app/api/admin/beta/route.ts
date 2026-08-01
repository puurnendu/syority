/**
 * M7.6G.1 — Beta Management API
 *
 * POST /api/admin/beta — Clone, Suspend, Archive, Reset, Export, Import, Convert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { resetService } from '@/core/Platform/ResetService';
import { licenseService } from '@/core/Platform/LicenseService';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) return null;
  return session.user as any;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  switch (action) {
    case 'clone': {
      const { sourceOrgId, newSlug, newName } = body;
      if (!sourceOrgId || !newSlug) {
        return NextResponse.json({ error: 'sourceOrgId and newSlug required' }, { status: 422 });
      }
      const source = await prisma.organization.findUnique({ where: { id: sourceOrgId } });
      if (!source) return NextResponse.json({ error: 'Source org not found' }, { status: 404 });

      const cloned = await prisma.organization.create({
        data: {
          name: newName ?? `${source.name} (Clone)`,
          slug: newSlug,
          industry: source.industry,
          tenant_type: source.tenant_type,
          country: source.country,
          is_active: true,
        },
      });
      logger.audit('BetaAPI', 'Organization cloned', { sourceOrgId, clonedId: cloned.id });
      return NextResponse.json({ organization: cloned }, { status: 201 });
    }

    case 'suspend': {
      const { orgId } = body;
      if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 422 });
      await prisma.organization.update({
        where: { id: orgId },
        data: { is_active: false },
      });
      logger.audit('BetaAPI', 'Organization suspended', { orgId });
      return NextResponse.json({ success: true });
    }

    case 'activate': {
      const { orgId } = body;
      if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 422 });
      await prisma.organization.update({
        where: { id: orgId },
        data: { is_active: true },
      });
      logger.audit('BetaAPI', 'Organization activated', { orgId });
      return NextResponse.json({ success: true });
    }

    case 'archive': {
      const { orgId } = body;
      if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 422 });
      await prisma.organization.update({
        where: { id: orgId },
        data: { is_active: false, deleted_at: new Date() },
      });
      logger.audit('BetaAPI', 'Organization archived', { orgId });
      return NextResponse.json({ success: true });
    }

    case 'reset': {
      const { orgId, options = {} } = body;
      if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 422 });
      const result = await resetService.execute(orgId, options, user.id);
      return NextResponse.json(result);
    }

    case 'convert': {
      const { orgId, newLicenseType } = body;
      if (!orgId || !newLicenseType) {
        return NextResponse.json({ error: 'orgId and newLicenseType required' }, { status: 422 });
      }
      try {
        await licenseService.changeLicenseType(orgId, newLicenseType);
        logger.audit('BetaAPI', 'License converted', { orgId, newLicenseType });
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    case 'export': {
      const { orgId } = body;
      if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 422 });
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const users = await prisma.user.findMany({
        where: { organization_id: orgId, deleted_at: null },
        select: { id: true, name: true, email: true, role: true, is_active: true },
      });
      const roles = await prisma.role.findMany({ where: { organization_id: orgId } });
      return NextResponse.json({ organization: org, users, roles });
    }

    case 'health': {
      // Get org health scores
      const orgs = await prisma.organization.findMany({
        where: { deleted_at: null, slug: { not: 'syority-platform' } },
        select: { id: true, name: true, slug: true, is_active: true, created_at: true },
      });

      const health = await Promise.all(orgs.map(async (org) => {
        const userCount = await prisma.user.count({ where: { organization_id: org.id, deleted_at: null } });
        const workpackCount = await prisma.workpack.count({ where: { organization_id: org.id, deleted_at: null } });
        const feedbackCount = await prisma.platform_feedback.count({ where: { organization_id: org.id } });

        // Simple health score (0-100)
        let score = 50;
        if (userCount > 0) score += 15;
        if (userCount > 3) score += 10;
        if (workpackCount > 0) score += 15;
        if (org.is_active) score += 10;
        if (feedbackCount > 0) score -= 5; // negative signal if lots of issues
        score = Math.max(0, Math.min(100, score));

        return {
          ...org,
          userCount,
          workpackCount,
          feedbackCount,
          healthScore: score,
        };
      }));

      return NextResponse.json({ organizations: health });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
