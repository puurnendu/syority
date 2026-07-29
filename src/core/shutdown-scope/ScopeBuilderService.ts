import { prisma } from '@/lib/prisma';

export class ScopeBuilderService {
  /**
   * Get hierarchy tree for the event's scoped units/systems.
   * Returns: Plant → Unit → System → Assets (with scope status).
   */
  static async getHierarchyTree(orgId: string, scopeId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
      include: {
        event: {
          include: {
            eventUnits: { select: { unit_id: true } },
            eventSystems: { select: { system_id: true } },
          },
        },
      },
    });
    if (!scope) throw new Error('Scope not found');

    const unitIds = scope.event.eventUnits.map((u) => u.unit_id);
    const systemIds = scope.event.eventSystems.map((s) => s.system_id);

    // Get existing scope items to mark assets as "in scope"
    const scopedAssetIds = new Set(
      (await prisma.scopeItem.findMany({
        where: { scope_id: scopeId, deleted_at: null },
        select: { asset_id: true },
      })).map((i) => i.asset_id)
    );

    // Get all assets in event's units/systems
    const whereAssets: any = {
      organization_id: orgId,
      deleted_at: null,
      OR: [] as any[],
    };
    if (unitIds.length > 0) whereAssets.OR.push({ unit_id: { in: unitIds } });
    if (systemIds.length > 0) whereAssets.OR.push({ system_id: { in: systemIds } });
    if (whereAssets.OR.length === 0) whereAssets.OR.push({ id: 'none' }); // no units/systems scoped

    const assets = await prisma.asset.findMany({
      where: whereAssets,
      select: {
        id: true, tag_number: true, name: true, asset_type: true,
        plant_id: true, unit_id: true, system_id: true,
        criticality: true, description: true,
        _count: { select: { engineering_issues: true } },
      },
      orderBy: { tag_number: 'asc' },
    });

    // Build tree: Unit → System → Asset
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    const systems = await prisma.system.findMany({
      where: { id: { in: systemIds } },
      select: { id: true, name: true, code: true, unit_id: true },
      orderBy: { name: 'asc' },
    });

    return {
      event: { id: scope.event.id, name: scope.event.name, code: scope.event.code },
      units: units.map((unit) => ({
        ...unit,
        systems: systems
          .filter((s) => s.unit_id === unit.id)
          .map((sys) => ({
            ...sys,
            assets: assets
              .filter((a) => a.system_id === sys.id)
              .map((a) => ({
                ...a,
                in_scope: scopedAssetIds.has(a.id),
                issue_count: a._count.engineering_issues,
              })),
          })),
        // Assets directly under unit (no system)
        assets: assets
          .filter((a) => a.unit_id === unit.id && !a.system_id)
          .map((a) => ({
            ...a,
            in_scope: scopedAssetIds.has(a.id),
            issue_count: a._count.engineering_issues,
          })),
      })),
      // Assets with no unit (rare edge case)
      unassigned_assets: assets
        .filter((a) => !a.unit_id)
        .map((a) => ({
          ...a,
          in_scope: scopedAssetIds.has(a.id),
          issue_count: a._count.engineering_issues,
        })),
      totals: {
        total_assets: assets.length,
        in_scope: scopedAssetIds.size,
        not_in_scope: assets.length - scopedAssetIds.size,
      },
    };
  }

  /**
   * Get unscoped engineering issues for the event.
   * Issues that are matched to assets within the event's units/systems but not yet in scope.
   */
  static async getUnscopedIssues(orgId: string, scopeId: string, params?: {
    department?: string;
    discipline?: string;
    priority?: string;
    page?: number;
    pageSize?: number;
  }) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
      include: {
        event: {
          include: {
            eventUnits: { select: { unit_id: true } },
          },
        },
      },
    });
    if (!scope) throw new Error('Scope not found');

    const unitIds = scope.event.eventUnits.map((u) => u.unit_id);

    // Issues already linked to scope items
    const linkedIssueIds = (await prisma.scopeItemIssueLink.findMany({
      where: { scope_item: { scope_id: scopeId, deleted_at: null } },
      select: { issue_id: true },
    })).map((l) => l.issue_id);

    const where: any = {
      organization_id: orgId,
      asset_id: { not: null },
      unit_id: { in: unitIds },
      deleted_at: null,
      id: { notIn: linkedIssueIds },
      status: { in: ['draft', 'matched', 'pending_review'] },
    };
    if (params?.department) where.department = params.department;
    if (params?.discipline) where.discipline = params.discipline;
    if (params?.priority) where.priority = params.priority;

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;

    const [data, total] = await Promise.all([
      prisma.engineeringIssue.findMany({
        where,
        include: {
          asset: { select: { id: true, tag_number: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.engineeringIssue.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}
