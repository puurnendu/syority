import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['review'],
  review: ['draft', 'approved'],
  approved: ['frozen'],
  frozen: ['closed'],
  closed: [],
};

export class ShutdownScopeService {
  /** Create a new scope for an event */
  static async createScope(data: {
    organizationId: string;
    eventId: string;
    siteId: string;
    name: string;
    description?: string;
    objectives?: string;
    freezeDate?: string;
    budgetManhours?: number;
    budgetCost?: number;
    userId: string;
  }) {
    // Verify no existing scope for this event
    const existing = await prisma.shutdownScope.findUnique({
      where: { event_id: data.eventId },
    });
    if (existing) throw new Error('Scope already exists for this event');

    const scope = await prisma.shutdownScope.create({
      data: {
        id: randomUUID(),
        organization_id: data.organizationId,
        event_id: data.eventId,
        site_id: data.siteId,
        name: data.name,
        description: data.description,
        objectives: data.objectives,
        freeze_date: data.freezeDate ? new Date(data.freezeDate) : null,
        budget_manhours: data.budgetManhours,
        budget_cost: data.budgetCost,
        created_by: data.userId,
      },
    });

    // Audit log
    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: scope.id,
        user_id: data.userId,
        action: 'create',
        entity_type: 'scope',
        entity_id: scope.id,
        new_value: data.name,
      },
    });

    return scope;
  }

  /** Get scope by ID with live stats */
  static async getScope(orgId: string, scopeId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
      include: {
        event: {
          select: {
            id: true, name: true, code: true, planned_start: true,
            planned_end: true, status: true, site_id: true,
          },
        },
      },
    });
    if (!scope) return null;

    // Live stats
    const items = await prisma.scopeItem.groupBy({
      by: ['discipline', 'priority', 'is_deferred', 'is_additional'],
      where: { scope_id: scopeId, deleted_at: null },
      _count: true,
      _sum: { estimated_hours: true },
    });

    let total = 0, deferred = 0, additional = 0, totalHrs = 0;
    const byDiscipline: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    for (const g of items) {
      total += g._count;
      totalHrs += g._sum.estimated_hours || 0;
      if (g.is_deferred) deferred += g._count;
      if (g.is_additional) additional += g._count;
      if (g.discipline) byDiscipline[g.discipline] = (byDiscipline[g.discipline] || 0) + g._count;
      if (g.priority) byPriority[g.priority] = (byPriority[g.priority] || 0) + g._count;
    }

    const changeRequests = await prisma.scopeChangeRequest.groupBy({
      by: ['status'],
      where: { scope_id: scopeId },
      _count: true,
    });

    const packages = await prisma.scopePackage.count({ where: { scope_id: scopeId } });

    return {
      ...scope,
      live_stats: {
        total_items: total,
        total_estimated_hrs: totalHrs,
        deferred,
        additional,
        packages,
        by_discipline: Object.entries(byDiscipline).map(([d, c]) => ({ discipline: d, count: c })),
        by_priority: Object.entries(byPriority).map(([p, c]) => ({ priority: p, count: c })),
        change_requests: changeRequests.reduce((acc, cr) => ({ ...acc, [cr.status]: cr._count }), {} as Record<string, number>),
      },
    };
  }

  /** Get scope for an event */
  static async getScopeByEvent(orgId: string, eventId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { event_id: eventId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!scope) return null;
    return this.getScope(orgId, scope.id);
  }

  /** List all scopes for org */
  static async listScopes(params: {
    organizationId: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { organizationId, status, search, page = 1, pageSize = 25 } = params;
    const where: any = { organization_id: organizationId, deleted_at: null };
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.shutdownScope.findMany({
        where,
        include: {
          event: { select: { id: true, name: true, code: true, planned_start: true, planned_end: true, status: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.shutdownScope.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /** Update scope metadata */
  static async updateScope(orgId: string, scopeId: string, data: Record<string, any>, userId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
    });
    if (!scope) throw new Error('Scope not found');
    if (scope.status === 'frozen' || scope.status === 'closed') {
      throw new Error(`Cannot update scope in ${scope.status} status`);
    }

    const updateData: any = { updated_by: userId };
    const allowedFields = ['name', 'description', 'objectives', 'freeze_date', 'budget_manhours', 'budget_cost'];
    for (const f of allowedFields) {
      if (data[f] !== undefined) {
        if (f === 'freeze_date') updateData[f] = data[f] ? new Date(data[f]) : null;
        else updateData[f] = data[f];
      }
    }

    return prisma.shutdownScope.update({
      where: { id: scopeId },
      data: updateData,
    });
  }

  /** Change scope status — enforces state machine */
  static async changeStatus(orgId: string, scopeId: string, newStatus: string, userId: string, notes?: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
    });
    if (!scope) throw new Error('Scope not found');

    const allowed = VALID_TRANSITIONS[scope.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${scope.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`);
    }

    const updateData: any = { status: newStatus, updated_by: userId };

    if (newStatus === 'approved') {
      updateData.approved_at = new Date();
      updateData.approved_by = userId;
    } else if (newStatus === 'frozen') {
      updateData.frozen_at = new Date();
      updateData.frozen_by = userId;
      // Recalculate totals
      const agg = await prisma.scopeItem.aggregate({
        where: { scope_id: scopeId, deleted_at: null, is_deferred: false },
        _count: true,
        _sum: { estimated_hours: true },
      });
      updateData.total_items = agg._count;
      updateData.total_estimated_hrs = agg._sum.estimated_hours || 0;
    } else if (newStatus === 'closed') {
      updateData.closed_at = new Date();
      updateData.closed_by = userId;
    }

    const updated = await prisma.shutdownScope.update({
      where: { id: scopeId },
      data: updateData,
    });

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: scopeId,
        user_id: userId,
        action: newStatus === 'frozen' ? 'freeze' : newStatus === 'approved' ? 'approve' : newStatus === 'closed' ? 'close' : 'status_change',
        entity_type: 'scope',
        entity_id: scopeId,
        old_value: scope.status,
        new_value: newStatus,
        notes,
      },
    });

    return updated;
  }

  /** Dashboard stats for scope list page */
  static async getDashboardStats(orgId: string) {
    const scopes = await prisma.shutdownScope.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, status: true, total_items: true, total_estimated_hrs: true },
    });

    const byStatus: Record<string, number> = {};
    let totalItems = 0, totalHrs = 0;
    for (const s of scopes) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      totalItems += s.total_items;
      totalHrs += s.total_estimated_hrs;
    }

    return {
      total_scopes: scopes.length,
      total_items: totalItems,
      total_estimated_hrs: totalHrs,
      by_status: Object.entries(byStatus).map(([s, c]) => ({ status: s, count: c })),
    };
  }
}
