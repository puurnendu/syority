import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Project / Event refinement for Planner Core (no execution modules).
 */
export class EventPlanningService {
  static async list(organizationId: string) {
    return prisma.event.findMany({
      where: { organization_id: organizationId, deleted_at: null },
      include: {
        site: { select: { id: true, name: true, code: true } },
        discipline: { select: { id: true, name: true, code: true } },
        calendar: { select: { id: true, name: true } },
        parentEvent: { select: { id: true, code: true, name: true } },
        childEvents: {
          where: { deleted_at: null },
          select: { id: true, code: true, name: true, status: true, planned_start: true, planned_end: true },
        },
        milestones: { orderBy: { sort_order: 'asc' } },
        _count: { select: { Workpack: true, eventUnits: true, wbsNodes: true } },
      },
      orderBy: [{ planned_start: 'desc' }, { created_at: 'desc' }],
    });
  }

  static async get(eventId: string, organizationId: string) {
    return prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId, deleted_at: null },
      include: {
        site: true,
        discipline: true,
        calendar: true,
        parentEvent: true,
        childEvents: { where: { deleted_at: null } },
        milestones: { orderBy: { sort_order: 'asc' } },
        wbsNodes: { orderBy: { order: 'asc' }, take: 200 },
        _count: { select: { Workpack: true, eventUnits: true } },
      },
    });
  }

  static async create(organizationId: string, userId: string, data: {
    name: string;
    code: string;
    site_id: string;
    event_type?: string;
    planned_start?: string | null;
    planned_end?: string | null;
    status?: string;
    scope_notes?: string;
    description?: string;
    budget_manhours?: number;
    budget_cost?: number;
    calendar_id?: string | null;
    discipline_id?: string | null;
    parent_event_id?: string | null;
  }) {
    // Enforce tenant-scoped uniqueness on event code
    const existing = await prisma.event.findFirst({
      where: { organization_id: organizationId, code: data.code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`Event code "${data.code}" already exists in this organization`);
    }

    return prisma.event.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        site_id: data.site_id,
        name: data.name,
        code: data.code,
        event_type: data.event_type || 'turnaround',
        planned_start: data.planned_start ? new Date(data.planned_start) : null,
        planned_end: data.planned_end ? new Date(data.planned_end) : null,
        status: data.status || 'planning',
        scope_notes: data.scope_notes ?? null,
        description: data.description ?? null,
        budget_manhours: data.budget_manhours ?? null,
        budget_cost: data.budget_cost ?? null,
        calendar_id: data.calendar_id ?? null,
        discipline_id: data.discipline_id ?? null,
        parent_event_id: data.parent_event_id ?? null,
        created_by: userId,
        updated_at: new Date(),
      },
    });
  }

  static async update(eventId: string, organizationId: string, data: Record<string, unknown>) {
    const existing = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId, deleted_at: null },
    });
    if (!existing) throw new Error('Event not found');

    return prisma.event.update({
      where: { id: eventId },
      data: {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.code !== undefined && { code: String(data.code) }),
        ...(data.event_type !== undefined && { event_type: String(data.event_type) }),
        ...(data.status !== undefined && { status: String(data.status) }),
        ...(data.scope_notes !== undefined && { scope_notes: data.scope_notes as string | null }),
        ...(data.description !== undefined && { description: data.description as string | null }),
        ...(data.calendar_id !== undefined && { calendar_id: data.calendar_id as string | null }),
        ...(data.discipline_id !== undefined && { discipline_id: data.discipline_id as string | null }),
        ...(data.parent_event_id !== undefined && { parent_event_id: data.parent_event_id as string | null }),
        ...(data.planned_start !== undefined && {
          planned_start: data.planned_start ? new Date(String(data.planned_start)) : null,
        }),
        ...(data.planned_end !== undefined && {
          planned_end: data.planned_end ? new Date(String(data.planned_end)) : null,
        }),
        ...(data.budget_manhours !== undefined && {
          budget_manhours: data.budget_manhours
            ? parseInt(String(data.budget_manhours), 10)
            : null,
        }),
        ...(data.budget_cost !== undefined && {
          budget_cost: data.budget_cost ? parseFloat(String(data.budget_cost)) : null,
        }),
        updated_at: new Date(),
      },
    });
  }

  static async listMilestones(eventId: string, organizationId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId, deleted_at: null },
      select: { id: true },
    });
    if (!event) throw new Error('Event not found');
    return prisma.eventMilestone.findMany({
      where: { event_id: eventId },
      orderBy: { sort_order: 'asc' },
    });
  }

  static async upsertMilestone(
    eventId: string,
    organizationId: string,
    userId: string,
    data: {
      id?: string;
      name: string;
      code?: string;
      milestone_type?: string;
      planned_date?: string | null;
      actual_date?: string | null;
      status?: string;
      sort_order?: number;
      notes?: string;
    }
  ) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId, deleted_at: null },
    });
    if (!event) throw new Error('Event not found');

    if (data.id) {
      return prisma.eventMilestone.update({
        where: { id: data.id },
        data: {
          name: data.name,
          code: data.code ?? null,
          milestone_type: data.milestone_type || 'planning',
          planned_date: data.planned_date ? new Date(data.planned_date) : null,
          actual_date: data.actual_date ? new Date(data.actual_date) : null,
          status: data.status || 'pending',
          sort_order: data.sort_order ?? 0,
          notes: data.notes ?? null,
        },
      });
    }

    return prisma.eventMilestone.create({
      data: {
        organization_id: organizationId,
        event_id: eventId,
        name: data.name,
        code: data.code ?? null,
        milestone_type: data.milestone_type || 'planning',
        planned_date: data.planned_date ? new Date(data.planned_date) : null,
        actual_date: data.actual_date ? new Date(data.actual_date) : null,
        status: data.status || 'pending',
        sort_order: data.sort_order ?? 0,
        notes: data.notes ?? null,
        created_by: userId,
      },
    });
  }

  static async deleteMilestone(milestoneId: string, organizationId: string) {
    const m = await prisma.eventMilestone.findFirst({
      where: { id: milestoneId, organization_id: organizationId },
    });
    if (!m) throw new Error('Milestone not found');
    await prisma.eventMilestone.delete({ where: { id: milestoneId } });
    return { ok: true };
  }
}
