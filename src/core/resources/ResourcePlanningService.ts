import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface ResourceActivityInput {
  id?: string;
  description?: string | null;
  planned_start?: string | Date | null;
  duration_hours?: number | Prisma.Decimal | string | null;
  is_critical?: boolean | null;
  total_float?: number | Prisma.Decimal | null;
  resources: Array<{
    resource_type_id: string | null;
    contractor_id?: string | null;
    planned_hours?: number | Prisma.Decimal | null;
    headcount?: number | null;
    crew_size?: number | null;
    resource_type?: string | null;
    quantity?: number | Prisma.Decimal | null;
  }>;
}

export interface ResourceCapacityInput {
  target_date: string | Date;
  resource_type_id: string;
  contractor_id?: string | null;
  shift_id?: string | null;
  capacity_limit: number | Prisma.Decimal;
  resource_type?: { name?: string } | null;
}

export interface DemandVsCapacityResult {
  date: string;
  shift: string | null;
  resource_type_id: string;
  resource_type_name: string;
  contractor_id: string | null;
  planned_demand: number;
  available_capacity: number;
  variance: number;
  utilization_percent: number | null;
  is_over_allocated: boolean;
}

export class ResourcePlanningService {
  /**
   * Shift Management
   */
  static async listShifts(eventId: string, organizationId: string) {
    return prisma.shiftDefinition.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
      },
      orderBy: { start_time: 'asc' },
    });
  }

  static async createShift(eventId: string, organizationId: string, input: { shift_name: string; start_time: string; end_time: string }) {
    // Validate event belongs to organization
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId },
    });
    if (!event) throw new Error('Event not found or access denied');

    return prisma.shiftDefinition.create({
      data: {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        event_id: eventId,
        shift_name: input.shift_name,
        start_time: input.start_time,
        end_time: input.end_time,
      },
    });
  }

  static async updateShift(eventId: string, organizationId: string, shiftId: string, input: { shift_name?: string; start_time?: string; end_time?: string }) {
    const existing = await prisma.shiftDefinition.findFirst({
      where: { id: shiftId, event_id: eventId, organization_id: organizationId },
    });
    if (!existing) throw new Error('Shift not found or access denied');

    return prisma.shiftDefinition.update({
      where: { id: shiftId },
      data: {
        shift_name: input.shift_name !== undefined ? input.shift_name : existing.shift_name,
        start_time: input.start_time !== undefined ? input.start_time : existing.start_time,
        end_time: input.end_time !== undefined ? input.end_time : existing.end_time,
      },
    });
  }

  static async deleteShift(eventId: string, organizationId: string, shiftId: string) {
    const existing = await prisma.shiftDefinition.findFirst({
      where: { id: shiftId, event_id: eventId, organization_id: organizationId },
      include: { resource_capacities: true }
    });
    if (!existing) throw new Error('Shift not found or access denied');

    // Prevent deletion if capacities are linked to it
    if (existing.resource_capacities.length > 0) {
      throw new Error('Cannot delete shift because it is referenced by existing ResourceCapacity records');
    }

    return prisma.shiftDefinition.delete({
      where: { id: shiftId },
    });
  }

  /**
   * Capacity Management
   */
  static async listCapacity(eventId: string, organizationId: string, filters?: { startDate?: string; endDate?: string; resourceTypeId?: string; contractorId?: string; shiftId?: string }) {
    const where: any = {
      event_id: eventId,
      organization_id: organizationId,
    };

    if (filters?.resourceTypeId) where.resource_type_id = filters.resourceTypeId;
    if (filters?.contractorId) where.contractor_id = filters.contractorId;
    if (filters?.shiftId) where.shift_id = filters.shiftId;
    if (filters?.startDate || filters?.endDate) {
      where.target_date = {};
      if (filters.startDate) where.target_date.gte = new Date(filters.startDate);
      if (filters.endDate) where.target_date.lte = new Date(filters.endDate);
    }

    return prisma.resourceCapacity.findMany({
      where,
      include: {
        resource_type: true,
        contractor: true,
        shift: true,
      },
      orderBy: { target_date: 'asc' },
    });
  }

  static async upsertCapacity(eventId: string, organizationId: string, input: { 
    resource_type_id: string; 
    target_date: string; 
    capacity_limit: number; 
    contractor_id?: string | null; 
    shift_id?: string | null; 
    notes?: string; 
  }) {
    if (input.capacity_limit < 0) {
      throw new Error('Capacity limit cannot be negative');
    }

    // Verify Event
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId },
    });
    if (!event) throw new Error('Event not found or access denied');

    // Verify ResourceType
    const rt = await prisma.resourceType.findFirst({
      where: { id: input.resource_type_id, organization_id: organizationId },
    });
    if (!rt) throw new Error('ResourceType not found or access denied');

    // Verify Contractor if supplied
    if (input.contractor_id) {
      const contractor = await prisma.contractor.findFirst({
        where: { id: input.contractor_id, organization_id: organizationId },
      });
      if (!contractor) throw new Error('Contractor not found or access denied');
    }

    // Verify ShiftDefinition if supplied
    if (input.shift_id) {
      const shift = await prisma.shiftDefinition.findFirst({
        where: { id: input.shift_id, event_id: eventId, organization_id: organizationId },
      });
      if (!shift) throw new Error('ShiftDefinition not found or access denied');
    }

    const targetDate = new Date(input.target_date);
    
    // Check if it already exists (composite unique key constraint approach or findFirst)
    const existing = await prisma.resourceCapacity.findFirst({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        resource_type_id: input.resource_type_id,
        contractor_id: input.contractor_id || null,
        shift_id: input.shift_id || null,
        target_date: targetDate,
      },
    });

    if (existing) {
      return prisma.resourceCapacity.update({
        where: { id: existing.id },
        data: {
          capacity_limit: input.capacity_limit,
          notes: input.notes !== undefined ? input.notes : existing.notes,
        },
      });
    }

    return prisma.resourceCapacity.create({
      data: {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        event_id: eventId,
        resource_type_id: input.resource_type_id,
        contractor_id: input.contractor_id || null,
        shift_id: input.shift_id || null,
        target_date: targetDate,
        capacity_limit: input.capacity_limit,
        notes: input.notes,
      },
    });
  }

  static async updateCapacity(eventId: string, organizationId: string, capacityId: string, input: { capacity_limit?: number; notes?: string }) {
    if (input.capacity_limit !== undefined && input.capacity_limit < 0) {
      throw new Error('Capacity limit cannot be negative');
    }

    const existing = await prisma.resourceCapacity.findFirst({
      where: { id: capacityId, event_id: eventId, organization_id: organizationId },
    });
    if (!existing) throw new Error('ResourceCapacity not found or access denied');

    return prisma.resourceCapacity.update({
      where: { id: capacityId },
      data: {
        capacity_limit: input.capacity_limit !== undefined ? input.capacity_limit : existing.capacity_limit,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
    });
  }

  static async deleteCapacity(eventId: string, organizationId: string, capacityId: string) {
    const existing = await prisma.resourceCapacity.findFirst({
      where: { id: capacityId, event_id: eventId, organization_id: organizationId },
    });
    if (!existing) throw new Error('ResourceCapacity not found or access denied');

    return prisma.resourceCapacity.delete({
      where: { id: capacityId },
    });
  }

  /**
   * Pure Demand vs Capacity Calculation Engine (In-Memory / Deterministic)
   */
  static calculateDemandVsCapacity(
    activities: ResourceActivityInput[],
    capacities: ResourceCapacityInput[],
    resourceTypeNames?: Map<string, string>,
    filters?: {
      startDate?: string;
      endDate?: string;
      resourceTypeId?: string;
      contractorId?: string;
      shiftId?: string;
    }
  ): DemandVsCapacityResult[] {
    const windowStart = filters?.startDate ? new Date(filters.startDate) : new Date(0);
    const windowEnd = filters?.endDate ? new Date(filters.endDate) : new Date(8640000000000000);

    const demandMap = new Map<string, number>();
    const getMapKey = (dateStr: string, shiftId: string, rtId: string, contractorId: string) => {
      return `${dateStr}|${shiftId}|${rtId}|${contractorId}`;
    };

    const rtNames = new Map<string, string>(resourceTypeNames || []);
    const HOURS_PER_DAY = 10;

    for (const act of activities) {
      if (!act.planned_start || !act.duration_hours || !act.resources || act.resources.length === 0) continue;
      
      const start = new Date(act.planned_start);
      start.setUTCHours(0, 0, 0, 0);
      const durationHours = Number(act.duration_hours);
      const durationDays = Math.max(1, Math.ceil(durationHours / HOURS_PER_DAY));

      for (const res of act.resources) {
        if (!res.resource_type_id) continue;
        
        let resourceDemandTotal = 0;
        if (res.resource_type === 'machine' || res.resource_type === 'material') {
          resourceDemandTotal = Number(res.quantity || 1);
        } else {
          resourceDemandTotal = (res.headcount || 1) * (res.crew_size || 1);
        }

        const demandPerDay = resourceDemandTotal;
        const rtId = res.resource_type_id;
        const contractorId = res.contractor_id || 'null';
        const shiftId = 'null';

        if (filters?.resourceTypeId && rtId !== filters.resourceTypeId) continue;
        if (filters?.contractorId && res.contractor_id !== filters.contractorId) continue;
        if (filters?.shiftId) continue;

        for (let day = 0; day < durationDays; day++) {
          const d = new Date(start);
          d.setDate(d.getDate() + day);
          if (d < windowStart || d > windowEnd) continue;

          const dateStr = d.toISOString().slice(0, 10);
          const key = getMapKey(dateStr, shiftId, rtId, contractorId);

          demandMap.set(key, (demandMap.get(key) || 0) + demandPerDay);
        }
      }
    }

    const capacityMap = new Map<string, number>();
    for (const cap of capacities) {
      const targetDate = cap.target_date instanceof Date ? cap.target_date : new Date(cap.target_date);
      const dateStr = targetDate.toISOString().slice(0, 10);
      const rtId = cap.resource_type_id;
      const contractorId = cap.contractor_id || 'null';
      
      const dailyKey = getMapKey(dateStr, 'null', rtId, contractorId);
      capacityMap.set(dailyKey, (capacityMap.get(dailyKey) || 0) + Number(cap.capacity_limit));
      if (cap.resource_type?.name) rtNames.set(rtId, cap.resource_type.name);

      if (cap.shift_id) {
        const shiftKey = getMapKey(dateStr, cap.shift_id, rtId, contractorId);
        capacityMap.set(shiftKey, (capacityMap.get(shiftKey) || 0) + Number(cap.capacity_limit));
      }
    }

    const allKeys = new Set<string>([...capacityMap.keys(), ...demandMap.keys()]);
    const results: DemandVsCapacityResult[] = [];

    for (const key of allKeys) {
      const [dateStr, shiftId, rtId, contractorId] = key.split('|');
      const demand = demandMap.get(key) || 0;
      const capacity = capacityMap.get(key) || 0;
      const variance = capacity - demand;
      
      let utilizationPercent = null;
      if (capacity > 0) {
        utilizationPercent = (demand / capacity) * 100;
      } else if (demand > 0) {
        utilizationPercent = null; 
      }

      const isOverAllocated = demand > capacity;

      results.push({
        date: dateStr,
        shift: shiftId === 'null' ? null : shiftId,
        resource_type_id: rtId,
        resource_type_name: rtNames.get(rtId) || 'Unknown',
        contractor_id: contractorId === 'null' ? null : contractorId,
        planned_demand: Number(demand.toFixed(2)),
        available_capacity: Number(capacity.toFixed(2)),
        variance: Number(variance.toFixed(2)),
        utilization_percent: utilizationPercent !== null ? Number(utilizationPercent.toFixed(2)) : null,
        is_over_allocated: isOverAllocated
      });
    }

    results.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.resource_type_id !== b.resource_type_id) return a.resource_type_id.localeCompare(b.resource_type_id);
      return 0;
    });

    return results;
  }

  /**
   * Live Database Demand vs Capacity Engine (M8.7 / M8.8 compatible)
   */
  static async getDemandVsCapacity(
    eventId: string,
    organizationId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      resourceTypeId?: string;
      contractorId?: string;
      shiftId?: string;
    }
  ): Promise<DemandVsCapacityResult[]> {
    // 1. Fetch Capacity
    const capacities = await this.listCapacity(eventId, organizationId, filters);

    // 2. Fetch Demand from ActivityResource via Activity
    const activities = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'cancelled' },
        planned_start: { not: null },
        duration_hours: { not: null, gt: 0 },
      },
      select: {
        id: true,
        description: true,
        planned_start: true,
        duration_hours: true,
        is_critical: true,
        total_float: true,
        resources: {
          select: {
            resource_type_id: true,
            contractor_id: true,
            planned_hours: true,
            headcount: true,
            crew_size: true,
            resource_type: true,
            quantity: true
          }
        }
      }
    });

    // 3. Fetch all resource types for the org to get names
    const allResourceTypes = await prisma.resourceType.findMany({
      where: { organization_id: organizationId },
      select: { id: true, name: true }
    });
    const rtNames = new Map<string, string>();
    for (const rt of allResourceTypes) {
      rtNames.set(rt.id, rt.name);
    }

    // 4. Delegate to pure calculator
    return this.calculateDemandVsCapacity(activities, capacities, rtNames, filters);
  }
}
