/**
 * M8.12 — Material Constraint Service
 *
 * CRUD operations for MaterialSupplyRecord and MaterialConstraint.
 * Handles supply record lifecycle and dashboard aggregation.
 */
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

// ── Supply Record Types ────────────────────────────────────────────────

export interface CreateSupplyRecordInput {
  organization_id: string;
  material_line_id: string;
  supplier_name?: string;
  po_number?: string;
  po_line_number?: string;
  quantity_ordered: number;
  quantity_received?: number;
  expected_delivery?: string;  // ISO date
  delivery_status?: string;
  unit_cost?: number;
  notes?: string;
  created_by?: string;
}

export interface UpdateSupplyRecordInput {
  supplier_name?: string;
  po_number?: string;
  po_line_number?: string;
  quantity_ordered?: number;
  quantity_received?: number;
  expected_delivery?: string;
  actual_delivery?: string;
  delivery_status?: string;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
}

// ── Dashboard Types ────────────────────────────────────────────────────

export interface MaterialDashboardData {
  summary: {
    total_material_lines: number;
    critical_count: number;
    ready_count: number;
    partial_count: number;
    not_ready_count: number;
    blocked_count: number;
    not_assessed_count: number;
    overall_readiness_percent: number;
  };
  supply_overview: {
    total_supply_records: number;
    pending_deliveries: number;
    in_transit: number;
    received: number;
    delayed: number;
  };
  binding_constraints: {
    activity_id: string;
    activity_description: string;
    constraint_date: string | null;
    impact_days: number;
    readiness_status: string;
    material_description: string;
  }[];
  recent_supply_activity: {
    id: string;
    po_number: string | null;
    supplier_name: string | null;
    quantity_ordered: number;
    delivery_status: string;
    expected_delivery: string | null;
    material_description: string;
  }[];
}

// ── Service ────────────────────────────────────────────────────────────

export class MaterialConstraintService {

  /**
   * Create a supply record for a material line.
   */
  static async createSupplyRecord(input: CreateSupplyRecordInput) {
    // Verify material line exists and belongs to org
    const materialLine = await prisma.workpack_material_lines.findFirst({
      where: { id: input.material_line_id },
      include: { workpack: { select: { organization_id: true } } },
    });

    if (!materialLine || materialLine.workpack.organization_id !== input.organization_id) {
      throw new Error('Material line not found or access denied');
    }

    const record = await prisma.materialSupplyRecord.create({
      data: {
        organization_id: input.organization_id,
        material_line_id: input.material_line_id,
        supplier_name: input.supplier_name,
        po_number: input.po_number,
        po_line_number: input.po_line_number,
        quantity_ordered: input.quantity_ordered,
        quantity_received: input.quantity_received ?? 0,
        expected_delivery: input.expected_delivery ? new Date(input.expected_delivery) : null,
        delivery_status: input.delivery_status ?? 'pending',
        unit_cost: input.unit_cost,
        total_cost: input.unit_cost ? input.unit_cost * input.quantity_ordered : null,
        notes: input.notes,
        created_by: input.created_by,
      },
    });

    // Update material line aggregates
    await this.updateLineAggregates(input.material_line_id);

    return record;
  }

  /**
   * Update a supply record.
   */
  static async updateSupplyRecord(
    recordId: string,
    orgId: string,
    input: UpdateSupplyRecordInput
  ) {
    const existing = await prisma.materialSupplyRecord.findFirst({
      where: { id: recordId, organization_id: orgId },
    });

    if (!existing) throw new Error('Supply record not found or access denied');

    const record = await prisma.materialSupplyRecord.update({
      where: { id: recordId },
      data: {
        ...input,
        expected_delivery: input.expected_delivery ? new Date(input.expected_delivery) : undefined,
        actual_delivery: input.actual_delivery ? new Date(input.actual_delivery) : undefined,
      },
    });

    await this.updateLineAggregates(existing.material_line_id);

    return record;
  }

  /**
   * Delete a supply record.
   */
  static async deleteSupplyRecord(recordId: string, orgId: string) {
    const existing = await prisma.materialSupplyRecord.findFirst({
      where: { id: recordId, organization_id: orgId },
    });

    if (!existing) throw new Error('Supply record not found or access denied');

    await prisma.materialSupplyRecord.delete({ where: { id: recordId } });
    await this.updateLineAggregates(existing.material_line_id);
  }

  /**
   * List supply records for an event.
   */
  static async listSupplyRecords(eventId: string, orgId: string) {
    // Get all workpack IDs for this event
    const workpacks = await prisma.workpack.findMany({
      where: { event_id: eventId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    const wpIds = workpacks.map((w) => w.id);
    if (wpIds.length === 0) return [];

    const lines = await prisma.workpack_material_lines.findMany({
      where: { workpack_id: { in: wpIds }, deleted_at: null },
      select: { id: true },
    });
    const lineIds = lines.map((l) => l.id);
    if (lineIds.length === 0) return [];

    return prisma.materialSupplyRecord.findMany({
      where: { material_line_id: { in: lineIds }, organization_id: orgId },
      include: {
        materialLine: { select: { description: true, workpack_id: true, is_critical: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Update aggregate quantities on material line from supply records.
   */
  private static async updateLineAggregates(materialLineId: string) {
    const records = await prisma.materialSupplyRecord.findMany({
      where: { material_line_id: materialLineId, delivery_status: { not: 'cancelled' } },
    });

    const totalOrdered = records.reduce((s, r) => s + r.quantity_ordered, 0);
    const totalReceived = records.reduce((s, r) => s + r.quantity_received, 0);

    // Find latest ETA among pending/in-transit records
    const pendingRecords = records.filter(
      (r) => r.delivery_status !== 'received' && r.delivery_status !== 'cancelled'
    );
    const etas = pendingRecords
      .map((r) => r.expected_delivery)
      .filter((d): d is Date => d !== null);
    const latestEta = etas.length > 0 ? etas.sort((a, b) => b.getTime() - a.getTime())[0] : null;

    // Determine readiness status
    const line = await prisma.workpack_material_lines.findUnique({
      where: { id: materialLineId },
      select: { quantity_required: true },
    });

    const required = line?.quantity_required ?? 0;
    let readiness = 'not_assessed';
    if (required === 0) {
      readiness = 'ready';
    } else if (totalReceived >= required) {
      readiness = 'ready';
    } else if (totalReceived > 0 && totalReceived < required) {
      readiness = latestEta ? 'partial' : 'blocked';
    } else if (totalOrdered >= (required - totalReceived) && latestEta) {
      readiness = 'not_ready';
    } else if (totalOrdered > 0) {
      readiness = 'not_ready';
    } else {
      readiness = 'blocked';
    }

    await prisma.workpack_material_lines.update({
      where: { id: materialLineId },
      data: {
        quantity_available: totalReceived,
        quantity_on_order: totalOrdered,
        expected_eta: latestEta,
        material_readiness: readiness,
      },
    });
  }

  /**
   * Get material dashboard data for an event.
   */
  static async getDashboard(eventId: string, orgId: string): Promise<MaterialDashboardData> {
    // Get workpack IDs
    const workpacks = await prisma.workpack.findMany({
      where: { event_id: eventId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    const wpIds = workpacks.map((w) => w.id);

    // Material line summary
    const lines = wpIds.length > 0
      ? await prisma.workpack_material_lines.findMany({
          where: { workpack_id: { in: wpIds }, deleted_at: null },
          select: {
            is_critical: true,
            material_readiness: true,
            quantity_required: true,
            quantity_available: true,
          },
        })
      : [];

    const critical = lines.filter((l) => l.is_critical).length;
    const readyCnt = lines.filter((l) => l.material_readiness === 'ready').length;
    const partialCnt = lines.filter((l) => l.material_readiness === 'partial').length;
    const notReadyCnt = lines.filter((l) => l.material_readiness === 'not_ready').length;
    const blockedCnt = lines.filter((l) => l.material_readiness === 'blocked').length;
    const notAssessedCnt = lines.filter((l) => l.material_readiness === 'not_assessed').length;

    const totalReq = lines.reduce((s, l) => s + l.quantity_required, 0);
    const totalAvail = lines.reduce(
      (s, l) => s + Math.min(l.quantity_available, l.quantity_required),
      0
    );
    const overallPct = totalReq > 0 ? (totalAvail / totalReq) * 100 : 100;

    // Supply records summary
    const lineIds = wpIds.length > 0
      ? (await prisma.workpack_material_lines.findMany({
          where: { workpack_id: { in: wpIds }, deleted_at: null },
          select: { id: true },
        })).map((l) => l.id)
      : [];

    const supplyRecords = lineIds.length > 0
      ? await prisma.materialSupplyRecord.findMany({
          where: { material_line_id: { in: lineIds } },
          include: { materialLine: { select: { description: true } } },
          orderBy: { created_at: 'desc' },
        })
      : [];

    const pendingDel = supplyRecords.filter((r) => r.delivery_status === 'pending').length;
    const inTransit = supplyRecords.filter((r) => r.delivery_status === 'in_transit').length;
    const received = supplyRecords.filter((r) => r.delivery_status === 'received').length;
    const delayed = supplyRecords.filter((r) => r.delivery_status === 'delayed').length;

    // Binding constraints
    const constraints = await prisma.materialConstraint.findMany({
      where: { event_id: eventId, organization_id: orgId, is_binding: true },
      include: {
        activity: { select: { description: true } },
      },
      orderBy: { impact_days: 'desc' },
      take: 10,
    });

    return {
      summary: {
        total_material_lines: lines.length,
        critical_count: critical,
        ready_count: readyCnt,
        partial_count: partialCnt,
        not_ready_count: notReadyCnt,
        blocked_count: blockedCnt,
        not_assessed_count: notAssessedCnt,
        overall_readiness_percent: Math.round(overallPct * 10) / 10,
      },
      supply_overview: {
        total_supply_records: supplyRecords.length,
        pending_deliveries: pendingDel,
        in_transit: inTransit,
        received,
        delayed,
      },
      binding_constraints: constraints.map((c) => ({
        activity_id: c.activity_id,
        activity_description: c.activity.description,
        constraint_date: c.constraint_date?.toISOString().slice(0, 10) ?? null,
        impact_days: c.impact_days,
        readiness_status: c.readiness_status,
        material_description: '',
      })),
      recent_supply_activity: supplyRecords.slice(0, 10).map((r) => ({
        id: r.id,
        po_number: r.po_number,
        supplier_name: r.supplier_name,
        quantity_ordered: r.quantity_ordered,
        delivery_status: r.delivery_status,
        expected_delivery: r.expected_delivery?.toISOString().slice(0, 10) ?? null,
        material_description: r.materialLine.description,
      })),
    };
  }
}
