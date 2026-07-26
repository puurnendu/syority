import { prisma } from '@/lib/prisma';

/**
 * Verify that a resource belongs to the user's organization.
 * Throws a 403-compatible error if the resource is not found in their org.
 * Use this in every API route that reads a resource by ID.
 */
export async function assertTenantAccess(
  resource: 'workpack' | 'project' | 'equipment' | 'activity' | 'permit' | 'punchItem' | 'constraint',
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
        where: { id: resourceId, orgId: organizationId },
        select: { id: true },
      }));
      break;
    case 'equipment':
      found = !!(await prisma.equipment.findFirst({
        where: { id: resourceId, project: { orgId: organizationId } },
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
        found = !!(await prisma.permit.findFirst({
            where: { id: resourceId, project: { orgId: organizationId } },
            select: { id: true },
        }));
        break;
    case 'punchItem':
        found = !!(await prisma.punchItem.findFirst({
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
