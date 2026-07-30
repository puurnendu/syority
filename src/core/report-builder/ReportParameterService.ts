/**
 * M7.6A — Report Parameter Service
 *
 * Manages reusable filter parameters and resolves dynamic options.
 */

import { prisma } from '@/lib/prisma';

export class ReportParameterService {
  /**
   * List all active parameters.
   */
  static async list() {
    return prisma.report_parameters.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * Get parameters for a specific report definition.
   */
  static async getForDefinition(definitionId: string) {
    const links = await prisma.report_definition_parameters.findMany({
      where: { definition_id: definitionId },
      include: { parameter: true },
      orderBy: { sort_order: 'asc' },
    });
    return links.map((l) => ({
      ...l.parameter,
      is_required: l.is_required,
      sort_order: l.sort_order,
    }));
  }

  /**
   * Resolve dynamic options for a parameter.
   * Queries the Prisma model specified in options_source.
   */
  static async resolveOptions(
    parameterKey: string,
    organizationId: string
  ): Promise<Array<{ value: string; label: string }>> {
    const param = await prisma.report_parameters.findUnique({
      where: { key: parameterKey },
    });
    if (!param) return [];

    // Static options
    if (param.options_static) {
      return param.options_static as Array<{ value: string; label: string }>;
    }

    // Dynamic options from DB
    if (param.options_source) {
      return ReportParameterService.queryOptionsSource(
        param.options_source,
        organizationId
      );
    }

    return [];
  }

  /**
   * Query a Prisma model for select options.
   */
  private static async queryOptionsSource(
    source: string,
    orgId: string
  ): Promise<Array<{ value: string; label: string }>> {
    try {
      switch (source) {
        case 'Organization':
          return (
            await prisma.organization.findMany({
              where: { is_active: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((o) => ({ value: o.id, label: o.name }));

        case 'Site':
          return (
            await prisma.site.findMany({
              where: { organization_id: orgId, is_active: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((s) => ({ value: s.id, label: s.name }));

        case 'Unit':
          return (
            await prisma.unit.findMany({
              where: { organization_id: orgId, is_active: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((u) => ({ value: u.id, label: u.name }));

        case 'Area':
          return (
            await prisma.area.findMany({
              where: { organization_id: orgId },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((a) => ({ value: a.id, label: a.name }));

        case 'System':
          return (
            await prisma.system.findMany({
              where: { organization_id: orgId },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((s) => ({ value: s.id, label: s.name }));

        case 'Asset':
          return (
            await prisma.asset.findMany({
              where: { organization_id: orgId },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
              take: 500,
            })
          ).map((a) => ({ value: a.id, label: a.name }));

        case 'Event':
          return (
            await prisma.event.findMany({
              where: { organization_id: orgId },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((e) => ({ value: e.id, label: e.name }));

        case 'Contractor':
          return (
            await prisma.contractor.findMany({
              where: { organization_id: orgId, is_active: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((c) => ({ value: c.id, label: c.name }));

        case 'Discipline':
          return (
            await prisma.discipline.findMany({
              where: { organization_id: orgId, is_active: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          ).map((d) => ({ value: d.id, label: d.name }));

        case 'WorkType':
          return (
            await prisma.workType.findMany({
              where: { OR: [{ organization_id: orgId }, { organization_id: null }], is_active: true },
              select: { id: true, name: true, category: true },
              orderBy: { name: 'asc' },
            })
          ).map((w) => ({ value: w.id, label: `${w.category} — ${w.name}` }));

        default:
          console.warn(`[ReportParameterService] Unknown options source: ${source}`);
          return [];
      }
    } catch (err: any) {
      console.error(`[ReportParameterService] Error querying ${source}:`, err.message);
      return [];
    }
  }
}
