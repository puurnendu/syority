/**
 * M7.7.1 — Tenant Clone Service
 *
 * Clones an existing tenant's structure, master data, and configuration
 * into a new organization. Never clones users, passwords, audit logs,
 * or execution data.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { randomUUID } from 'node:crypto';
import { provisioningJobService } from '@/core/Platform/ProvisioningJobService';
import type { ProvisioningRequest } from '@/core/Platform/TenantProvisioningService';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CloneOptions {
  include: {
    org_structure?: boolean;    // Sites, Plants, Areas, Units, Systems
    roles?: boolean;            // Roles
    master_data?: boolean;      // Disciplines, Equipment Types
    templates?: boolean;        // Report templates, form templates
    calendars?: boolean;        // Schedule Calendars
    notification_templates?: boolean;
  };
  // New admin for cloned org
  admin: {
    name: string;
    email: string;
    tempPassword: string;
  };
  // License
  license: {
    type: 'professional' | 'enterprise' | 'unlimited';
    seatCount: number;
    expiresAt?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class TenantCloneService {

  /**
   * Clone an existing organization into a new one.
   * Creates a provisioning job for tracking.
   */
  async clone(
    sourceOrgId: string,
    newSlug: string,
    newName: string,
    options: CloneOptions,
    operatorId: string,
  ): Promise<string> {

    // Fetch source org
    const sourceOrg = await prisma.organization.findUnique({
      where: { id: sourceOrgId },
      include: {
        Site: { where: { deleted_at: null } },
        Plant: true,
        Area: true,
        Unit: true,
        System: true,
        Role: true,
        Discipline: true,
      },
    });

    if (!sourceOrg) {
      throw new Error('Source organization not found');
    }

    // Build a ProvisioningRequest from the source org
    const site = sourceOrg.Site[0];
    const plants: ProvisioningRequest['hierarchy']['plants'] = [];

    if (options.include.org_structure) {
      for (const plant of sourceOrg.Plant) {
        const plantAreas = sourceOrg.Area.filter((a: any) => a.plant_id === plant.id);
        const plantDirectUnits = sourceOrg.Unit.filter((u: any) => u.plant_id === plant.id && !u.area_id);

        const areas = plantAreas.map((area: any) => {
          const areaUnits = sourceOrg.Unit.filter((u: any) => u.area_id === area.id);
          return {
            name: area.name,
            code: area.code || '',
            units: areaUnits.map((u: any) => ({
              name: u.name,
              code: u.code || '',
              systems: sourceOrg.System
                .filter((s: any) => s.unit_id === u.id)
                .map((s: any) => ({ name: s.name, code: s.code || '' })),
            })),
          };
        });

        plants.push({
          name: plant.name,
          code: plant.code || '',
          areas,
          units: plantDirectUnits.map((u: any) => ({
            name: u.name,
            code: u.code || '',
            systems: sourceOrg.System
              .filter((s: any) => s.unit_id === u.id)
              .map((s: any) => ({ name: s.name, code: s.code || '' })),
          })),
        });
      }
    }

    const disciplines = options.include.master_data
      ? sourceOrg.Discipline.map((d: any) => d.code).filter(Boolean) as string[]
      : [];

    const request: ProvisioningRequest = {
      company: {
        name: newName,
        slug: newSlug,
        industry: sourceOrg.industry || undefined,
        country: sourceOrg.country || undefined,
        timezone: sourceOrg.timezone || 'UTC',
        currency: sourceOrg.currency || 'USD',
      },
      license: {
        type: options.license.type,
        seatCount: options.license.seatCount,
        expiresAt: options.license.expiresAt,
        enabledModules: [],
        aiCredits: 1000,
        storageQuotaGb: 50,
        documentQuota: 1000,
      },
      hierarchy: { plants, disciplines },
      site: {
        name: site?.name ?? `${newName} Main Site`,
        code: site?.code ?? newSlug.toUpperCase().slice(0, 4),
        address: (site as any)?.location ?? '',
        timezone: (site as any)?.timezone ?? sourceOrg.timezone ?? 'UTC',
      },
      admin: {
        name: options.admin.name,
        email: options.admin.email,
        tempPassword: options.admin.tempPassword,
        mustChangePassword: true,
        sendWelcomeEmail: true,
      },
      provisionedBy: operatorId,
    };

    // Enqueue as a provisioning job
    const jobId = await provisioningJobService.enqueue(request, operatorId);

    logger.audit('TenantCloneService', 'Clone job enqueued', {
      sourceOrgId,
      newSlug,
      jobId,
    });

    return jobId;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const tenantCloneService = new TenantCloneService();
