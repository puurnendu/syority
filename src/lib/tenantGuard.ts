import { prisma } from '@/lib/prisma';

/**
 * Verify that a resource belongs to the user's organization.
 * Throws a 403-compatible error if the resource is not found in their org.
 * Use this in every API route that reads a resource by ID.
 */
export async function assertTenantAccess(
  resource: 'workpack' | 'project' | 'equipment' | 'asset' | 'activity' | 'permit' | 'punchItem' | 'constraint',
  resourceId: string,
  organizationId: string
): Promise<void> {
  let found = false;

  switch (resource) {
    case 'workpack':
      found = !!(await prisma.workpack.findFirst({
        where: { id: resourceId, organization_id: organizationId },
        select: { id: true },
      }));
      break;
    case 'project':
      found = !!(await prisma.project.findFirst({
        where: { id: resourceId, org_id: organizationId },
        select: { id: true },
      }));
      break;
    case 'equipment':
    case 'asset':
      found = !!(await prisma.asset.findFirst({
        where: { id: resourceId, organization_id: organizationId },
        select: { id: true },
      }));
      break;
    case 'activity':
      found = !!(await prisma.activity.findFirst({
        where: { id: resourceId, workpack: { organization_id: organizationId } },
        select: { id: true },
      }));
      break;
    case 'permit':
        // M12-R0.1: Permit now has organization_id — use it for tenant isolation
        found = !!(await prisma.permit.findFirst({
            where: { id: resourceId, organization_id: organizationId },
            select: { id: true },
        }));
        break;
    case 'punchItem':
        found = !!(await prisma.punchListItem.findFirst({
            where: { id: resourceId, workpack: { organization_id: organizationId } },
            select: { id: true },
        }));
        break;
    case 'constraint':
        found = !!(await prisma.constraintLog.findFirst({
            where: { id: resourceId, organization_id: organizationId },
            select: { id: true },
        }));
        break;
    default:
      console.warn(`[tenantGuard] No tenant check implemented for resource type: ${resource}`);
      found = true; // Fallback to allow if not yet mapped, but logged
  }

  if (!found) {
    throw Object.assign(new Error('Resource not found or access denied'), { statusCode: 403 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// M8.14-R1 — Cross-Tenant FK Guard (defense-in-depth)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Assert that a hierarchy entity (site, plant, area, unit, system) belongs
 * to the same organization as the requesting user. Use when setting FK
 * references on creation/update to prevent cross-tenant FK injection.
 *
 * Example:
 *   await assertSameOrg(prisma, orgId, 'site', body.site_id);
 *   await assertSameOrg(prisma, orgId, 'system', body.system_id);
 */
export async function assertSameOrg(
  db: any,
  orgId: string,
  model: 'site' | 'plant' | 'area' | 'unit' | 'system' | 'asset',
  id: string,
): Promise<void> {
  const entity = await (db as any)[model].findFirst({
    where: { id, organization_id: orgId },
    select: { id: true },
  });
  if (!entity) {
    throw Object.assign(
      new Error(`${model} "${id}" not found in your organization`),
      { statusCode: 403 },
    );
  }
}

/**
 * Validate multiple FK references belong to the same organization.
 * Skips null/undefined values.
 */
export async function assertAllSameOrg(
  db: any,
  orgId: string,
  refs: Array<[string, string | null | undefined]>,
): Promise<void> {
  const validRefs = refs.filter(([, id]) => id != null) as Array<[string, string]>;
  await Promise.all(
    validRefs.map(([model, id]) =>
      assertSameOrg(db, orgId, model as any, id),
    ),
  );
}
