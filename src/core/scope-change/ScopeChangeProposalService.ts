/**
 * M8.11 — ScopeChangeProposalService
 *
 * Manages the lifecycle of scope change proposals — formal proposals
 * for adding/modifying/removing activities and workpacks.
 *
 * Lifecycle: draft → analyzing → proposed → approved → applying → applied / rejected
 *
 * PROTECTED SYSTEMS: This service does NOT directly write to Activity, Workpack,
 * or any M8.7/M8.8/M8.9/M8.10 tables. Application is delegated to
 * ScopeChangeApplicationService.
 */
import { prisma } from '@/lib/prisma';
import { DiscoveryWorkService } from './DiscoveryWorkService';
import {
  loadScopeChange,
  recordSecurityRejection,
  validateItemReferences,
  isScopeChangeSecurityError,
} from './ScopeChangeOwnership';

export interface ScopeChangeCallContext {
  eventId?: string | null;
  userId?: string | null;
  scopeChangeId?: string | null;
}

// ── Types ──────────────────────────────────────────────────────────────

export type ChangeCategory =
  | 'scope_addition'
  | 'scope_removal'
  | 'scope_modification'
  | 'activity_addition'
  | 'duration_change'
  | 'resource_change';

export type ScopeChangeStatus =
  | 'draft'
  | 'analyzing'
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'applying'
  | 'applied';

export type ItemType = 'new_activity' | 'new_workpack' | 'modify_activity' | 'remove_activity';

export interface CreateScopeChangeInput {
  organization_id: string;
  event_id: string;
  discovery_id?: string;
  title: string;
  description?: string;
  change_category?: ChangeCategory;
  justification?: string;
  priority?: string;
  discipline?: string;
  created_by: string;
}

export interface AddItemInput {
  item_type?: ItemType;
  description: string;
  workpack_id?: string;
  activity_id?: string;
  discipline?: string;
  estimated_hours?: number;
  estimated_cost?: number;
  resource_type?: string;
  crew_size?: number;
  planned_start?: string;
  planned_end?: string;
  predecessor_ids?: string[];
  notes?: string;
}

// ── Service ────────────────────────────────────────────────────────────

export class ScopeChangeProposalService {
  /**
   * Generate the next change number for an org (e.g., SCH-001, SCH-002).
   */
  private static async nextChangeNumber(orgId: string): Promise<string> {
    const latest = await prisma.scheduleScopeChange.findFirst({
      where: { organization_id: orgId },
      orderBy: { change_number: 'desc' },
      select: { change_number: true },
    });

    if (!latest) return 'SCH-001';
    const num = parseInt(latest.change_number.replace('SCH-', ''), 10);
    return `SCH-${String(num + 1).padStart(3, '0')}`;
  }

  /**
   * List scope changes for an event.
   */
  static async listByEvent(
    eventId: string,
    orgId: string,
    filters?: { status?: ScopeChangeStatus; change_category?: ChangeCategory }
  ) {
    const where: any = { event_id: eventId, organization_id: orgId };
    if (filters?.status) where.status = filters.status;
    if (filters?.change_category) where.change_category = filters.change_category;

    return prisma.scheduleScopeChange.findMany({
      where,
      include: { items: { orderBy: { sort_order: 'asc' } } },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get a single scope change by ID.
   */
  static async getById(id: string, orgId: string, eventId?: string | null) {
    const where: { id: string; organization_id: string; event_id?: string } = {
      id,
      organization_id: orgId,
    };
    if (eventId) where.event_id = eventId;
    return prisma.scheduleScopeChange.findFirst({
      where,
      include: {
        items: { orderBy: { sort_order: 'asc' } },
        discovery: true,
      },
    });
  }

  /**
   * Create a new scope change proposal.
   */
  static async create(input: CreateScopeChangeInput) {
    // Validate event belongs to org
    const event = await prisma.event.findFirst({
      where: { id: input.event_id, organization_id: input.organization_id },
    });
    if (!event) throw new Error('Event not found');

    const changeNumber = await this.nextChangeNumber(input.organization_id);

    const result = await prisma.scheduleScopeChange.create({
      data: {
        organization_id: input.organization_id,
        event_id: input.event_id,
        discovery_id: input.discovery_id,
        change_number: changeNumber,
        title: input.title,
        description: input.description,
        change_category: input.change_category ?? 'scope_addition',
        justification: input.justification,
        status: 'draft',
        priority: input.priority ?? 'medium',
        discipline: input.discipline,
        created_by: input.created_by,
      },
      include: { items: true },
    });

    // If created from a discovery, mark it as converted
    if (input.discovery_id) {
      await DiscoveryWorkService.markConverted(
        input.discovery_id,
        input.organization_id,
        result.id
      );
    }

    return result;
  }

  /**
   * Update a scope change (only in draft status).
   */
  static async update(
    id: string,
    orgId: string,
    input: Partial<Pick<CreateScopeChangeInput, 'title' | 'description' | 'change_category' | 'justification' | 'priority' | 'discipline'>>,
    eventId?: string | null
  ) {
    const existing = await loadScopeChange(id, orgId, eventId);
    if (existing.status !== 'draft') {
      throw new Error(`Cannot update scope change in '${existing.status}' status. Must be 'draft'.`);
    }

    return prisma.scheduleScopeChange.update({
      where: { id },
      data: { ...input },
      include: { items: true },
    });
  }

  /**
   * Add a line item to a scope change (only in draft/analyzing status).
   */
  static async addItem(
    scopeChangeId: string,
    orgId: string,
    input: AddItemInput,
    ctx: ScopeChangeCallContext = {}
  ) {
    let sc;
    try {
      sc = await loadScopeChange(scopeChangeId, orgId, ctx.eventId);
      if (sc.status !== 'draft' && sc.status !== 'analyzing') {
        throw new Error(`Cannot add items in '${sc.status}' status`);
      }
      await validateItemReferences(orgId, sc.event_id, input);
    } catch (err) {
      if (isScopeChangeSecurityError(err)) {
        await recordSecurityRejection({
          organizationId: orgId,
          userId: ctx.userId,
          scopeChangeId,
          reason: err.securityCode,
        });
      }
      throw err;
    }

    const maxSort = await prisma.scheduleScopeChangeItem.aggregate({
      where: { scope_change_id: scopeChangeId },
      _max: { sort_order: true },
    });

    return prisma.scheduleScopeChangeItem.create({
      data: {
        scope_change_id: scopeChangeId,
        item_type: input.item_type ?? 'new_activity',
        description: input.description,
        workpack_id: input.workpack_id,
        activity_id: input.activity_id,
        discipline: input.discipline,
        estimated_hours: input.estimated_hours ?? 0,
        estimated_cost: input.estimated_cost ?? 0,
        resource_type: input.resource_type,
        crew_size: input.crew_size ?? 1,
        planned_start: input.planned_start ? new Date(input.planned_start) : null,
        planned_end: input.planned_end ? new Date(input.planned_end) : null,
        predecessor_ids: input.predecessor_ids ?? [],
        notes: input.notes,
        sort_order: (maxSort._max.sort_order ?? 0) + 1,
      },
    });
  }

  /**
   * Update a line item (only when parent scope change is in draft/analyzing status).
   */
  static async updateItem(
    itemId: string,
    orgId: string,
    input: Partial<AddItemInput>,
    ctx: ScopeChangeCallContext = {}
  ) {
    const item = await prisma.scheduleScopeChangeItem.findFirst({
      where: { id: itemId },
      include: { scopeChange: true },
    });
    if (!item || item.scopeChange.organization_id !== orgId) {
      throw new Error('Scope change item not found');
    }
    if (ctx.scopeChangeId && item.scope_change_id !== ctx.scopeChangeId) {
      throw new Error('Scope change item not found');
    }
    if (ctx.eventId && item.scopeChange.event_id !== ctx.eventId) {
      throw new Error('Scope change item not found');
    }
    if (item.scopeChange.status !== 'draft' && item.scopeChange.status !== 'analyzing') {
      throw new Error(`Cannot update items in '${item.scopeChange.status}' status`);
    }

    try {
      await validateItemReferences(orgId, item.scopeChange.event_id, {
        item_type: input.item_type ?? item.item_type,
        activity_id: input.activity_id !== undefined ? input.activity_id : item.activity_id,
        workpack_id: input.workpack_id !== undefined ? input.workpack_id : item.workpack_id,
        predecessor_ids: input.predecessor_ids ?? item.predecessor_ids,
      });
    } catch (err) {
      if (isScopeChangeSecurityError(err)) {
        await recordSecurityRejection({
          organizationId: orgId,
          userId: ctx.userId,
          scopeChangeId: item.scope_change_id,
          reason: err.securityCode,
        });
      }
      throw err;
    }

    const data: any = {};
    if (input.item_type !== undefined) data.item_type = input.item_type;
    if (input.description !== undefined) data.description = input.description;
    if (input.workpack_id !== undefined) data.workpack_id = input.workpack_id;
    if (input.activity_id !== undefined) data.activity_id = input.activity_id;
    if (input.discipline !== undefined) data.discipline = input.discipline;
    if (input.estimated_hours !== undefined) data.estimated_hours = input.estimated_hours;
    if (input.estimated_cost !== undefined) data.estimated_cost = input.estimated_cost;
    if (input.resource_type !== undefined) data.resource_type = input.resource_type;
    if (input.crew_size !== undefined) data.crew_size = input.crew_size;
    if (input.planned_start !== undefined) data.planned_start = input.planned_start ? new Date(input.planned_start) : null;
    if (input.planned_end !== undefined) data.planned_end = input.planned_end ? new Date(input.planned_end) : null;
    if (input.predecessor_ids !== undefined) data.predecessor_ids = input.predecessor_ids;
    if (input.notes !== undefined) data.notes = input.notes;

    return prisma.scheduleScopeChangeItem.update({
      where: { id: itemId },
      data,
    });
  }

  /**
   * Delete a line item (only when parent scope change is in draft/analyzing status).
   */
  static async deleteItem(itemId: string, orgId: string, ctx: ScopeChangeCallContext = {}) {
    const item = await prisma.scheduleScopeChangeItem.findFirst({
      where: { id: itemId },
      include: { scopeChange: true },
    });
    if (!item || item.scopeChange.organization_id !== orgId) {
      throw new Error('Scope change item not found');
    }
    if (ctx.scopeChangeId && item.scope_change_id !== ctx.scopeChangeId) {
      throw new Error('Scope change item not found');
    }
    if (ctx.eventId && item.scopeChange.event_id !== ctx.eventId) {
      throw new Error('Scope change item not found');
    }
    if (item.scopeChange.status !== 'draft' && item.scopeChange.status !== 'analyzing') {
      throw new Error(`Cannot delete items in '${item.scopeChange.status}' status`);
    }

    return prisma.scheduleScopeChangeItem.delete({ where: { id: itemId } });
  }

  /**
   * Submit a scope change for approval.
   * Transitions: draft/analyzing → proposed
   */
  static async submit(id: string, orgId: string, userId: string, eventId?: string | null) {
    const sc = await loadScopeChange(id, orgId, eventId);
    if (sc.status !== 'draft' && sc.status !== 'analyzing') {
      throw new Error(`Cannot submit scope change in '${sc.status}' status`);
    }
    const items = (sc.items ?? []) as Array<{
      item_type: string;
      activity_id: string | null;
      workpack_id: string | null;
      predecessor_ids: string[];
    }>;
    if (items.length === 0) {
      throw new Error('Cannot submit scope change with no items');
    }
    for (const item of items) {
      await validateItemReferences(orgId, sc.event_id, item);
    }

    return prisma.scheduleScopeChange.update({
      where: { id },
      data: {
        status: 'proposed',
        submitted_by: userId,
        submitted_at: new Date(),
      },
      include: { items: true },
    });
  }

  /**
   * Approve a scope change.
   * Transitions: proposed → approved
   */
  static async approve(id: string, orgId: string, userId: string, notes?: string, eventId?: string | null) {
    const sc = await loadScopeChange(id, orgId, eventId);
    if (sc.status !== 'proposed') {
      throw new Error(`Cannot approve scope change in '${sc.status}' status. Must be 'proposed'.`);
    }

    return prisma.scheduleScopeChange.update({
      where: { id },
      data: {
        status: 'approved',
        approved_by: userId,
        approved_at: new Date(),
        review_notes: notes,
      },
      include: { items: true },
    });
  }

  /**
   * Reject a scope change.
   * Transitions: proposed → rejected
   */
  static async reject(id: string, orgId: string, userId: string, notes: string, eventId?: string | null) {
    const sc = await loadScopeChange(id, orgId, eventId);
    if (sc.status !== 'proposed') {
      throw new Error(`Cannot reject scope change in '${sc.status}' status. Must be 'proposed'.`);
    }

    return prisma.scheduleScopeChange.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_notes: notes,
      },
      include: { items: true },
    });
  }

  /**
   * Get dashboard KPI summary for an event.
   */
  static async getDashboardSummary(eventId: string, orgId: string) {
    const all = await prisma.scheduleScopeChange.findMany({
      where: { event_id: eventId, organization_id: orgId },
      include: { items: true },
    });

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalItems = 0;
    let totalEstHours = 0;
    let totalEstCost = 0;
    let totalScheduleImpact = 0;
    let totalCostImpact = 0;

    for (const sc of all) {
      byStatus[sc.status] = (byStatus[sc.status] || 0) + 1;
      byCategory[sc.change_category] = (byCategory[sc.change_category] || 0) + 1;
      totalScheduleImpact += sc.schedule_impact_days;
      totalCostImpact += sc.cost_impact;
      for (const item of sc.items) {
        totalItems++;
        totalEstHours += item.estimated_hours;
        totalEstCost += item.estimated_cost;
      }
    }

    return {
      totalChanges: all.length,
      totalItems,
      byStatus,
      byCategory,
      totalEstimatedHours: totalEstHours,
      totalEstimatedCost: totalEstCost,
      totalScheduleImpactDays: totalScheduleImpact,
      totalCostImpact: totalCostImpact,
    };
  }
}
