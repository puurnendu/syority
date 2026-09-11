/**
 * M8.11 — DiscoveryWorkService
 *
 * Manages the lifecycle of discovery work records — newly found work
 * during turnaround execution that must flow through formal change control.
 *
 * Lifecycle: discovered → assessed → converted → closed / rejected
 *
 * PROTECTED SYSTEMS: This service does NOT write to Activity, Workpack,
 * or any M8.7/M8.8/M8.9/M8.10 tables.
 */
import { prisma } from '@/lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────

export type DiscoveryType =
  | 'field_discovery'
  | 'inspection_finding'
  | 'emergency'
  | 'opportunity'
  | 'engineering_change'
  | 'regulatory';

export type DiscoveryStatus = 'discovered' | 'assessed' | 'converted' | 'closed' | 'rejected';
export type DiscoveryPriority = 'critical' | 'high' | 'medium' | 'low';

export interface CreateDiscoveryInput {
  organization_id: string;
  event_id: string;
  title: string;
  description?: string;
  discovery_type?: DiscoveryType;
  source?: string;
  location?: string;
  asset_id?: string;
  discipline?: string;
  priority?: DiscoveryPriority;
  estimated_hours?: number;
  estimated_cost?: number;
  discovered_by: string;
}

export interface UpdateDiscoveryInput {
  title?: string;
  description?: string;
  discovery_type?: DiscoveryType;
  source?: string;
  location?: string;
  asset_id?: string;
  discipline?: string;
  priority?: DiscoveryPriority;
  estimated_hours?: number;
  estimated_cost?: number;
}

export interface AssessDiscoveryInput {
  assessed_by: string;
  assessment_notes: string;
  priority?: DiscoveryPriority;
  estimated_hours?: number;
  estimated_cost?: number;
}

// ── Service ────────────────────────────────────────────────────────────

export class DiscoveryWorkService {
  /**
   * List discovery work records for an event.
   */
  static async listByEvent(
    eventId: string,
    orgId: string,
    filters?: { status?: DiscoveryStatus; priority?: DiscoveryPriority; discovery_type?: DiscoveryType }
  ) {
    const where: any = { event_id: eventId, organization_id: orgId };
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.discovery_type) where.discovery_type = filters.discovery_type;

    return prisma.discoveryWork.findMany({
      where,
      orderBy: [
        { priority: 'asc' }, // critical first (alphabetic)
        { discovered_at: 'desc' },
      ],
    });
  }

  /**
   * Get a single discovery record by ID.
   */
  static async getById(id: string, orgId: string) {
    return prisma.discoveryWork.findFirst({
      where: { id, organization_id: orgId },
      include: { scopeChanges: true },
    });
  }

  /**
   * Create a new discovery record.
   */
  static async create(input: CreateDiscoveryInput) {
    // Validate event belongs to org
    const event = await prisma.event.findFirst({
      where: { id: input.event_id, organization_id: input.organization_id },
    });
    if (!event) throw new Error('Event not found or does not belong to organization');

    return prisma.discoveryWork.create({
      data: {
        organization_id: input.organization_id,
        event_id: input.event_id,
        title: input.title,
        description: input.description,
        discovery_type: input.discovery_type ?? 'field_discovery',
        source: input.source,
        location: input.location,
        asset_id: input.asset_id,
        discipline: input.discipline,
        priority: input.priority ?? 'medium',
        estimated_hours: input.estimated_hours ?? 0,
        estimated_cost: input.estimated_cost ?? 0,
        status: 'discovered',
        discovered_by: input.discovered_by,
      },
    });
  }

  /**
   * Update a discovery record (only in discovered/assessed status).
   */
  static async update(id: string, orgId: string, input: UpdateDiscoveryInput) {
    const existing = await prisma.discoveryWork.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!existing) throw new Error('Discovery record not found');
    if (existing.status !== 'discovered' && existing.status !== 'assessed') {
      throw new Error(`Cannot update discovery in '${existing.status}' status`);
    }

    return prisma.discoveryWork.update({
      where: { id },
      data: { ...input },
    });
  }

  /**
   * Assess a discovery record — adds assessment notes and optionally updates priority/estimates.
   * Transitions: discovered → assessed
   */
  static async assess(id: string, orgId: string, input: AssessDiscoveryInput) {
    const existing = await prisma.discoveryWork.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!existing) throw new Error('Discovery record not found');
    if (existing.status !== 'discovered') {
      throw new Error(`Cannot assess discovery in '${existing.status}' status. Must be 'discovered'.`);
    }

    return prisma.discoveryWork.update({
      where: { id },
      data: {
        status: 'assessed',
        assessed_by: input.assessed_by,
        assessed_at: new Date(),
        assessment_notes: input.assessment_notes,
        ...(input.priority && { priority: input.priority }),
        ...(input.estimated_hours !== undefined && { estimated_hours: input.estimated_hours }),
        ...(input.estimated_cost !== undefined && { estimated_cost: input.estimated_cost }),
      },
    });
  }

  /**
   * Mark discovery as converted — called when a scope change is created from it.
   * Transitions: discovered/assessed → converted
   */
  static async markConverted(id: string, orgId: string, scopeChangeId: string) {
    const existing = await prisma.discoveryWork.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!existing) throw new Error('Discovery record not found');
    if (existing.status === 'converted' || existing.status === 'closed' || existing.status === 'rejected') {
      throw new Error(`Cannot convert discovery in '${existing.status}' status`);
    }

    return prisma.discoveryWork.update({
      where: { id },
      data: {
        status: 'converted',
        scope_change_id: scopeChangeId,
      },
    });
  }

  /**
   * Reject a discovery — work deemed unnecessary or duplicate.
   * Transitions: discovered/assessed → rejected
   */
  static async reject(id: string, orgId: string, assessedBy: string, notes: string) {
    const existing = await prisma.discoveryWork.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!existing) throw new Error('Discovery record not found');
    if (existing.status === 'converted' || existing.status === 'closed') {
      throw new Error(`Cannot reject discovery in '${existing.status}' status`);
    }

    return prisma.discoveryWork.update({
      where: { id },
      data: {
        status: 'rejected',
        assessed_by: assessedBy,
        assessed_at: new Date(),
        assessment_notes: notes,
      },
    });
  }

  /**
   * Close a discovery — work is done via applied scope change.
   * Transitions: converted → closed
   */
  static async close(id: string, orgId: string) {
    const existing = await prisma.discoveryWork.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!existing) throw new Error('Discovery record not found');
    if (existing.status !== 'converted') {
      throw new Error(`Cannot close discovery in '${existing.status}' status. Must be 'converted'.`);
    }

    return prisma.discoveryWork.update({
      where: { id },
      data: { status: 'closed' },
    });
  }

  /**
   * Get summary KPIs for an event's discoveries.
   */
  static async getEventSummary(eventId: string, orgId: string) {
    const all = await prisma.discoveryWork.findMany({
      where: { event_id: eventId, organization_id: orgId },
      select: { status: true, priority: true, estimated_hours: true, estimated_cost: true },
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalHours = 0;
    let totalCost = 0;

    for (const d of all) {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      byPriority[d.priority] = (byPriority[d.priority] || 0) + 1;
      totalHours += d.estimated_hours;
      totalCost += d.estimated_cost;
    }

    return {
      total: all.length,
      byStatus,
      byPriority,
      totalEstimatedHours: totalHours,
      totalEstimatedCost: totalCost,
    };
  }
}
