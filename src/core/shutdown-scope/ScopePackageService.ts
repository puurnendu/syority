import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export class ScopePackageService {
  /** Create a scope package */
  static async createPackage(data: {
    organizationId: string;
    scopeId: string;
    name: string;
    packageType?: string;
    discipline?: string;
    area?: string;
    contractor?: string;
    riskLevel?: string;
    description?: string;
    userId: string;
  }) {
    return prisma.scopePackage.create({
      data: {
        id: randomUUID(),
        organization_id: data.organizationId,
        scope_id: data.scopeId,
        name: data.name,
        package_type: data.packageType || 'discipline',
        discipline: data.discipline,
        area: data.area,
        contractor: data.contractor,
        risk_level: data.riskLevel,
        description: data.description,
        created_by: data.userId,
      },
    });
  }

  /** List packages for a scope with item counts */
  static async listPackages(orgId: string, scopeId: string) {
    return prisma.scopePackage.findMany({
      where: { scope_id: scopeId, organization_id: orgId },
      include: {
        _count: { select: { items: true } },
        items: {
          where: { deleted_at: null },
          select: { estimated_hours: true },
        },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  /** Update a package */
  static async updatePackage(orgId: string, packageId: string, data: Record<string, any>) {
    const allowedFields = ['name', 'package_type', 'discipline', 'area', 'contractor', 'risk_level', 'description', 'sort_order'];
    const updateData: any = {};
    for (const f of allowedFields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    return prisma.scopePackage.update({
      where: { id: packageId },
      data: updateData,
    });
  }

  /** Assign items to a package */
  static async assignItems(orgId: string, packageId: string, itemIds: string[], userId: string) {
    const pkg = await prisma.scopePackage.findFirst({
      where: { id: packageId, organization_id: orgId },
    });
    if (!pkg) throw new Error('Package not found');

    await prisma.scopeItem.updateMany({
      where: { id: { in: itemIds }, scope_id: pkg.scope_id, deleted_at: null },
      data: { package_id: packageId, updated_by: userId },
    });

    // Recalculate package hours
    const agg = await prisma.scopeItem.aggregate({
      where: { package_id: packageId, deleted_at: null },
      _sum: { estimated_hours: true },
    });
    await prisma.scopePackage.update({
      where: { id: packageId },
      data: { estimated_hours: agg._sum.estimated_hours || 0 },
    });

    return { assigned: itemIds.length };
  }

  /** Auto-generate packages by discipline */
  static async autoGenerateByDiscipline(orgId: string, scopeId: string, userId: string) {
    const disciplines = await prisma.scopeItem.groupBy({
      by: ['discipline'],
      where: { scope_id: scopeId, deleted_at: null, discipline: { not: null } },
      _count: true,
      _sum: { estimated_hours: true },
    });

    let created = 0;
    for (const d of disciplines) {
      if (!d.discipline) continue;
      const name = `${d.discipline} Package`;
      const existing = await prisma.scopePackage.findFirst({
        where: { scope_id: scopeId, name },
      });
      if (existing) continue;

      const pkg = await prisma.scopePackage.create({
        data: {
          id: randomUUID(),
          organization_id: orgId,
          scope_id: scopeId,
          name,
          package_type: 'discipline',
          discipline: d.discipline,
          estimated_hours: d._sum.estimated_hours || 0,
          created_by: userId,
        },
      });

      // Assign items
      await prisma.scopeItem.updateMany({
        where: { scope_id: scopeId, discipline: d.discipline, deleted_at: null, package_id: null },
        data: { package_id: pkg.id, updated_by: userId },
      });

      created++;
    }

    return { packages_created: created };
  }
}
