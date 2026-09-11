/**
 * CONTROLLED VALUE RESOLVER SERVICE
 * Syority Turnaround Management Platform
 * 
 * Version: 1.3.0
 * Status: APPROVED ARCHITECTURE
 * 
 * Core Mandates:
 * 1. SEED DATA IS RECOMMENDATION/DEFAULT INTELLIGENCE ONLY.
 *    It must never become a mandatory restriction unless an explicit tenant business rule marks a value mandatory.
 * 2. The Triad of Value Governance:
 *    - SUGGESTED VALUE: High-fidelity recommendation provided by the system.
 *    - SELECTED VALUE: The value explicitly confirmed or chosen by the human planner.
 *    - ENFORCED VALUE: A value locked by an active, explicit, tenant-configured business rule.
 * 3. Prohibits arbitrary free-text entry into controlled dimensions.
 * 4. Provenance tracking: PLATFORM_DEFAULT | TENANT_DEFAULT | HISTORICAL_PATTERN | USER_SELECTED | AI_RECOMMENDATION.
 */

import { prisma } from '@/lib/prisma';

export type ValueGovernanceTier = 'SUGGESTED' | 'SELECTED' | 'ENFORCED';
export type ValueProvenance = 
  | 'PLATFORM_DEFAULT' 
  | 'TENANT_DEFAULT' 
  | 'HISTORICAL_PATTERN' 
  | 'USER_SELECTED' 
  | 'AI_RECOMMENDATION';

export interface GovernedValue<T> {
  value: T;
  tier: ValueGovernanceTier;
  provenance: ValueProvenance;
  rule_enforced?: boolean;
  rule_id?: string;
  rule_description?: string;
}

export interface ActivityDefaults {
  standard_activity_type_id: string;
  standard_activity_code: string;
  standard_activity_name: string;
  suggested_discipline_id?: string | null;
  suggested_discipline_code?: string | null;
  suggested_phase?: string | null;
  typical_duration_hours?: number | null;
  suggested_resources?: string[];
  suggested_readiness?: string[];
  provenance: ValueProvenance;
  is_enforced: boolean;
}

export interface HierarchyValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ImportValidationResult {
  valid: boolean;
  resolved: Record<string, any>;
  errors: string[];
  warnings: string[];
}

export class ControlledValidationError extends Error {
  public readonly field: string;
  public readonly rejectedValue: any;
  public readonly code: string;

  constructor(field: string, rejectedValue: any, message: string, code = 'INVALID_CONTROLLED_VALUE') {
    super(`[${code}] ${field}: ${message} (received: "${rejectedValue}")`);
    this.name = 'ControlledValidationError';
    this.field = field;
    this.rejectedValue = rejectedValue;
    this.code = code;
  }
}

export class ControlledValueResolver {
  // ── 1. Discipline Resolution ──────────────────────────────────────────
  static async resolveDiscipline(orgId: string, ref: string) {
    if (!ref || typeof ref !== 'string' || !ref.trim()) {
      return null;
    }
    const clean = ref.trim();

    // Check UUID match or Code match
    const disc = await prisma.discipline.findFirst({
      where: {
        organization_id: orgId,
        is_active: true,
        OR: [
          { id: clean },
          { code: { equals: clean, mode: 'insensitive' } },
        ],
      },
    });

    if (!disc) {
      throw new ControlledValidationError(
        'discipline',
        ref,
        `Discipline "${ref}" is not a valid active controlled discipline for this organization. Select a valid discipline or request an administrator to create it in Master Data.`
      );
    }

    return disc;
  }

  // ── 2. Equipment Type Resolution ──────────────────────────────────────
  static async resolveEquipmentType(orgId: string, ref: string) {
    if (!ref || typeof ref !== 'string' || !ref.trim()) {
      return null;
    }
    const clean = ref.trim();

    // Equipment types can be tenant-specific or platform-wide (org_id = platform org or matching orgId)
    const eqType = await prisma.equipmentType.findFirst({
      where: {
        is_active: true,
        OR: [
          { id: clean },
          { id: clean.toLowerCase() },
          { code: { equals: clean, mode: 'insensitive' } },
        ],
      },
    });

    if (!eqType) {
      throw new ControlledValidationError(
        'equipment_type',
        ref,
        `Equipment Type "${ref}" is not recognized in the governed equipment master library. Free-text equipment types are prohibited. Select a valid equipment type or create it in Master Data.`
      );
    }

    return eqType;
  }

  // ── 3. Asset (Equipment Tag) Resolution ───────────────────────────────
  static async resolveAsset(orgId: string, criteria: { id?: string; tagNumber?: string; plantId?: string; unitId?: string }) {
    const { id, tagNumber, plantId, unitId } = criteria;
    if (!id && !tagNumber) {
      return null;
    }

    const where: any = {
      organization_id: orgId,
      is_active: true,
    };

    if (id) {
      where.id = id;
    } else if (tagNumber) {
      where.tag_number = { equals: tagNumber.trim(), mode: 'insensitive' };
    }

    if (plantId) where.plant_id = plantId;
    if (unitId) where.unit_id = unitId;

    const asset = await prisma.asset.findFirst({
      where,
      include: {
        equipment_type_rel: true,
        plant: true,
        unit: true,
        system: true,
      },
    });

    if (!asset) {
      throw new ControlledValidationError(
        'asset',
        id || tagNumber,
        `Asset "${id || tagNumber}" could not be resolved under the specified plant/unit hierarchy.`
      );
    }

    return asset;
  }

  // ── 4. Contractor Resolution ──────────────────────────────────────────
  static async resolveContractor(orgId: string, ref: string) {
    if (!ref || typeof ref !== 'string' || !ref.trim()) {
      return null;
    }
    const clean = ref.trim();

    const contractor = await prisma.contractor.findFirst({
      where: {
        organization_id: orgId,
        is_active: true,
        deleted_at: null,
        OR: [
          { id: clean },
          { code: { equals: clean, mode: 'insensitive' } },
          { name: { equals: clean, mode: 'insensitive' } },
        ],
      },
    });

    if (!contractor) {
      throw new ControlledValidationError(
        'contractor',
        ref,
        `Contractor "${ref}" is not an active approved turnaround contractor for this organization.`
      );
    }

    return contractor;
  }

  // ── 5. Standard Activity Resolution ───────────────────────────────────
  static async resolveStandardActivity(equipmentTypeId: string, ref: string) {
    if (!ref || typeof ref !== 'string' || !ref.trim()) {
      return null;
    }
    const clean = ref.trim();

    const sat = await prisma.standardActivityType.findFirst({
      where: {
        equipment_type_id: equipmentTypeId,
        is_active: true,
        OR: [
          { id: clean },
          { code: { equals: clean, mode: 'insensitive' } },
        ],
      },
    });

    if (!sat) {
      throw new ControlledValidationError(
        'standard_activity_type',
        ref,
        `Standard Activity "${ref}" is not registered for equipment type "${equipmentTypeId}". Free-text standard activity classification is prohibited.`
      );
    }

    return sat;
  }

  // ── 6. UDF Option Resolution (Strict Dropdown / Multi-Select) ─────────
  static async resolveUdfOption(orgId: string, defRef: string, optionRef: string) {
    if (!defRef || !optionRef) {
      return null;
    }

    // 1. Resolve definition
    const def = await prisma.activityUdfDefinition.findFirst({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [
          { id: defRef },
          { code: { equals: defRef.trim(), mode: 'insensitive' } },
        ],
      },
      include: {
        options: {
          where: { is_active: true, deleted_at: null },
        },
      },
    });

    if (!def) {
      throw new ControlledValidationError(
        'udf_definition',
        defRef,
        `UDF Definition "${defRef}" does not exist in the organization's governed UDF catalog.`
      );
    }

    // If UDF is NOT select, return narrative/value container
    if (def.type !== 'select' && def.type !== 'dropdown') {
      return { definition: def, option: null, rawValue: optionRef };
    }

    // 2. Strict Option Resolution for Dropdown/Select
    const cleanOpt = optionRef.trim();
    const option = def.options.find(
      (o) =>
        o.id === cleanOpt ||
        o.value.toLowerCase() === cleanOpt.toLowerCase() ||
        (o.code_value && o.code_value.toLowerCase() === cleanOpt.toLowerCase())
    );

    if (!option) {
      throw new ControlledValidationError(
        `udf_${def.code}`,
        optionRef,
        `Option "${optionRef}" is not a valid active option for controlled UDF "${def.name}" (${def.code}). Free-text classification is prohibited. Select an active option or request an admin to add it.`
      );
    }

    return { definition: def, option, rawValue: option.value };
  }

  // ── 7. Seed Recommendation Intelligence (Suggestions, NOT Locks) ──────
  static async getSuggestedActivitiesForEquipment(equipmentTypeId: string): Promise<ActivityDefaults[]> {
    const eq = await this.resolveEquipmentType('', equipmentTypeId);
    if (!eq) return [];

    const sats = await prisma.standardActivityType.findMany({
      where: {
        equipment_type_id: eq.id,
        is_active: true,
      },
      orderBy: { sort_order: 'asc' },
    });

    // Provide default predictive attributes for each suggested standard activity
    return sats.map((sat) => {
      const defaults = getPredictiveDefaults(sat.code);
      return {
        standard_activity_type_id: sat.id,
        standard_activity_code: sat.code,
        standard_activity_name: sat.name,
        suggested_discipline_code: defaults.disciplineCode,
        suggested_phase: defaults.phase,
        typical_duration_hours: sat.typical_duration_hrs ?? defaults.duration,
        suggested_resources: defaults.resources,
        suggested_readiness: defaults.readiness,
        provenance: 'PLATFORM_DEFAULT',
        is_enforced: false, // Never forced by default; planner autonomy preserved
      };
    });
  }

  // ── 8. Plant Hierarchy Integrity Validation ───────────────────────────
  static async validateHierarchy(orgId: string, ids: { plantId?: string; areaId?: string; unitId?: string; systemId?: string }): Promise<HierarchyValidationResult> {
    const { plantId, areaId, unitId, systemId } = ids;
    const errors: string[] = [];

    let unit = null;
    if (unitId) {
      unit = await prisma.unit.findFirst({
        where: { id: unitId, organization_id: orgId },
      });
      if (!unit) {
        errors.push(`Unit ID "${unitId}" does not exist in this organization.`);
      } else {
        if (plantId && unit.plant_id !== plantId) {
          errors.push(`Unit "${unit.name}" (${unit.code}) belongs to plant "${unit.plant_id}", not the specified plant "${plantId}".`);
        }
        if (areaId && unit.area_id && unit.area_id !== areaId) {
          errors.push(`Unit "${unit.name}" (${unit.code}) belongs to area "${unit.area_id}", not the specified area "${areaId}".`);
        }
      }
    }

    if (systemId) {
      const system = await prisma.system.findFirst({
        where: { id: systemId, organization_id: orgId },
      });
      if (!system) {
        errors.push(`System ID "${systemId}" does not exist in this organization.`);
      } else if (unitId && system.unit_id !== unitId) {
        errors.push(`System "${system.name}" (${system.code}) belongs to unit "${system.unit_id}", not unit "${unitId}".`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ── 9. Batch Import Row Validation ────────────────────────────────────
  static async validateImportRow(orgId: string, entityType: 'asset' | 'activity' | 'workpack', row: Record<string, any>): Promise<ImportValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolved: Record<string, any> = {};

    if (entityType === 'asset') {
      // 1. Tag number validation
      const tag = row.tag_number || row.tag;
      if (!tag || !String(tag).trim()) {
        errors.push('Mandatory field "tag_number" is missing.');
      } else {
        resolved.tag_number = String(tag).trim();
      }

      // 2. Controlled Equipment Type validation
      const eqTypeRef = row.equipment_type || row.asset_type;
      if (eqTypeRef) {
        try {
          const resolvedEq = await this.resolveEquipmentType(orgId, String(eqTypeRef));
          resolved.equipment_type_id = resolvedEq?.id;
          resolved.equipment_type_name = resolvedEq?.name;
        } catch (err: any) {
          errors.push(err.message);
        }
      }

      // 3. Controlled Criticality validation
      const crit = row.criticality;
      if (crit) {
        const normalized = String(crit).toLowerCase().trim();
        const validCrit = ['low', 'medium', 'high', 'critical'];
        if (!validCrit.includes(normalized)) {
          errors.push(`Invalid criticality "${crit}". Must be one of: low, medium, high, critical.`);
        } else {
          resolved.criticality = normalized;
        }
      }
    }

    if (entityType === 'activity') {
      // 1. Controlled Discipline
      if (row.discipline) {
        try {
          const disc = await this.resolveDiscipline(orgId, String(row.discipline));
          resolved.discipline_id = disc?.id;
        } catch (err: any) {
          errors.push(err.message);
        }
      }

      // 2. Controlled Standard Activity Type
      if (row.standard_activity_type && row.equipment_type_id) {
        try {
          const sat = await this.resolveStandardActivity(row.equipment_type_id, String(row.standard_activity_type));
          resolved.standard_activity_type_id = sat?.id;
        } catch (err: any) {
          errors.push(err.message);
        }
      }
    }

    return {
      valid: errors.length === 0,
      resolved,
      errors,
      warnings,
    };
  }
}

/**
 * Industrial predictive defaults for standard activity codes.
 * Returns default discipline, phase, duration, and typical resources.
 */
function getPredictiveDefaults(satCode: string) {
  switch (satCode.toUpperCase()) {
    case 'HANDOVER':
      return { disciplineCode: 'OPS', phase: 'PREPARATION', duration: 4.0, resources: ['Operations Specialist', 'LOTO Officer'], readiness: ['Process Drain', 'LOTO Clearance'] };
    case 'BLIND':
      return { disciplineCode: 'MECH', phase: 'ISOLATION', duration: 8.0, resources: ['Mechanical Fitter x 2', 'Rigger x 1'], readiness: ['Blind List Sign-off', 'Gasket Kit'] };
    case 'BOX_OPEN':
    case 'MAN_OPEN':
    case 'DOOR_OPEN':
      return { disciplineCode: 'MECH', phase: 'MECHANICAL', duration: 12.0, resources: ['Mechanical Fitter x 2', 'Torque Specialist'], readiness: ['Flange Bolt Hydraulic Tool', 'Rigging Tag'] };
    case 'BPULL':
      return { disciplineCode: 'MECH', phase: 'MECHANICAL', duration: 16.0, resources: ['Bundle Extractor Operator x 1', 'Rigging Crew x 3', '50T Crane x 1'], readiness: ['Crane Lift Plan', 'Clearance Pad'] };
    case 'CLEAN':
      return { disciplineCode: 'CLN', phase: 'MECHANICAL', duration: 16.0, resources: ['Hydroblast Crew x 3', 'Water Jet Pump Operator'], readiness: ['Wash Pad Clearance', 'High Pressure PPE'] };
    case 'INSP':
      return { disciplineCode: 'INSP', phase: 'INSPECTION', duration: 24.0, resources: ['NDT Level II Inspector x 2', 'Metallurgist x 1'], readiness: ['Eddy Current Calibration', 'Scaffolding Tag'] };
    case 'REPAIR':
      return { disciplineCode: 'MECH', phase: 'MECHANICAL', duration: 40.0, resources: ['Pipefitter / Welder x 2', 'Mechanical Fitter x 2'], readiness: ['Approved Weld Procedure', 'Replacement Tubes'] };
    case 'BINST':
      return { disciplineCode: 'MECH', phase: 'BOX_UP', duration: 16.0, resources: ['Bundle Extractor Operator x 1', 'Rigging Crew x 3', '50T Crane x 1'], readiness: ['Shell Cleaning Sign-off', 'Crane Setup'] };
    case 'BOX_CLOSE':
    case 'MAN_CLOSE':
      return { disciplineCode: 'MECH', phase: 'BOX_UP', duration: 12.0, resources: ['Mechanical Fitter x 2', 'Hydraulic Torquing Crew'], readiness: ['Camprofile Gaskets', 'Torque Sheet'] };
    case 'LEAK_TEST':
      return { disciplineCode: 'MECH', phase: 'PRECOMM', duration: 8.0, resources: ['Hydrotest Specialist x 2', 'QA Inspector x 1'], readiness: ['Calibrated Pressure Gauge', 'Water Manifold'] };
    case 'DEBLIND':
      return { disciplineCode: 'MECH', phase: 'PRECOMM', duration: 8.0, resources: ['Mechanical Fitter x 2'], readiness: ['De-blind Verification Sheet'] };
    case 'ISOL':
      return { disciplineCode: 'ELEC', phase: 'PREPARATION', duration: 4.0, resources: ['High Voltage Electrician x 1', 'Mechanical Fitter x 1'], readiness: ['Lockout Box', 'Padlock Matrix'] };
    case 'ALIGN_CHK':
    case 'ALIGN':
      return { disciplineCode: 'MECH', phase: 'BOX_UP', duration: 6.0, resources: ['Millwright / Alignment Technician x 1'], readiness: ['Laser Alignment Tool'] };
    case 'DISASM':
      return { disciplineCode: 'MECH', phase: 'MECHANICAL', duration: 8.0, resources: ['Mechanical Fitter x 2'], readiness: ['Overhaul Stand'] };
    case 'BRG_REPL':
      return { disciplineCode: 'MECH', phase: 'MECHANICAL', duration: 8.0, resources: ['Rotating Equipment Specialist x 1'], readiness: ['Bearing Induction Heater', 'Seal Kit'] };
    case 'ASSEM':
      return { disciplineCode: 'MECH', phase: 'BOX_UP', duration: 8.0, resources: ['Mechanical Fitter x 2'], readiness: ['Casing Gaskets', 'Torque Specs'] };
    case 'RUN_TEST':
      return { disciplineCode: 'MECH', phase: 'COMMISSIONING', duration: 4.0, resources: ['Reliability Engineer x 1', 'Operations Technician x 1'], readiness: ['Lube Oil Level Check', 'Vibration Probe'] };
    default:
      return { disciplineCode: 'MECH', phase: 'MECHANICAL', duration: 8.0, resources: ['General Craftsman x 1'], readiness: ['Standard Permit'] };
  }
}
