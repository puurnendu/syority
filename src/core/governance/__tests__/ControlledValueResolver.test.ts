/**
 * CONTROLLED VALUE RESOLVER TESTS
 * Syority Turnaround Management Platform
 * 
 * Verifies:
 * 1. Master Data Resolution (Discipline, Equipment Type, Asset, Contractor)
 * 2. Suggestion Intelligence (Seed suggests values without enforcing locks)
 * 3. Prohibition of Arbitrary Free-Text Classification
 * 4. UDF Controlled Option Enforcement vs Free-Text Rejection
 * 5. Plant Hierarchy Integrity Validation
 * 6. Batch Import Row Validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ControlledValueResolver, ControlledValidationError } from '../ControlledValueResolver';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    discipline: {
      findFirst: vi.fn(),
    },
    equipmentType: {
      findFirst: vi.fn(),
    },
    asset: {
      findFirst: vi.fn(),
    },
    contractor: {
      findFirst: vi.fn(),
    },
    standardActivityType: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    activityUdfDefinition: {
      findFirst: vi.fn(),
    },
    unit: {
      findFirst: vi.fn(),
    },
    system: {
      findFirst: vi.fn(),
    },
  },
}));

describe('ControlledValueResolver', () => {
  const orgId = 'org-1234-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Discipline Resolution & Free-Text Rejection', () => {
    it('should resolve a valid active discipline by code', async () => {
      vi.mocked(prisma.discipline.findFirst).mockResolvedValue({
        id: 'disc-mech-uuid',
        organization_id: orgId,
        name: 'Mechanical',
        code: 'MECH',
        color: '#3B82F6',
        is_active: true,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await ControlledValueResolver.resolveDiscipline(orgId, 'MECH');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('MECH');
      expect(result?.name).toBe('Mechanical');
    });

    it('should throw ControlledValidationError when user enters arbitrary free-text discipline', async () => {
      vi.mocked(prisma.discipline.findFirst).mockResolvedValue(null);

      await expect(
        ControlledValueResolver.resolveDiscipline(orgId, 'Arbitrary FreeText Craft')
      ).rejects.toThrow(ControlledValidationError);

      await expect(
        ControlledValueResolver.resolveDiscipline(orgId, 'Arbitrary FreeText Craft')
      ).rejects.toThrow(/not a valid active controlled discipline/);
    });
  });

  describe('2. Equipment Type Resolution & Free-Text Rejection', () => {
    it('should resolve a valid equipment type by code', async () => {
      vi.mocked(prisma.equipmentType.findFirst).mockResolvedValue({
        id: 'hex-st',
        org_id: orgId,
        name: 'Shell & Tube Heat Exchanger',
        code: 'HEX-ST',
        description: 'TEMA shell-and-tube exchanger',
        is_active: true,
        created_at: new Date(),
      });

      const result = await ControlledValueResolver.resolveEquipmentType(orgId, 'HEX-ST');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('hex-st');
      expect(result?.code).toBe('HEX-ST');
    });

    it('should throw ControlledValidationError when user enters arbitrary free-text equipment type', async () => {
      vi.mocked(prisma.equipmentType.findFirst).mockResolvedValue(null);

      await expect(
        ControlledValueResolver.resolveEquipmentType(orgId, 'Custom Made Home Tank')
      ).rejects.toThrow(ControlledValidationError);

      await expect(
        ControlledValueResolver.resolveEquipmentType(orgId, 'Custom Made Home Tank')
      ).rejects.toThrow(/not recognized in the governed equipment master library/);
    });
  });

  describe('3. Suggestion Intelligence (Seed Suggests, Does Not Lock)', () => {
    it('should return recommended standard activities for Heat Exchanger (HEX-ST)', async () => {
      vi.mocked(prisma.equipmentType.findFirst).mockResolvedValue({
        id: 'hex-st',
        org_id: orgId,
        name: 'Shell & Tube Heat Exchanger',
        code: 'HEX-ST',
        description: null,
        is_active: true,
        created_at: new Date(),
      });

      vi.mocked(prisma.standardActivityType.findMany).mockResolvedValue([
        { id: 'sat-1', organization_id: null, equipment_type_id: 'hex-st', name: 'Handover', code: 'HANDOVER', description: null, is_mandatory: false, typical_duration_hrs: 4.0, sort_order: 5, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-2', organization_id: null, equipment_type_id: 'hex-st', name: 'Blinding', code: 'BLIND', description: null, is_mandatory: false, typical_duration_hrs: 8.0, sort_order: 10, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-3', organization_id: null, equipment_type_id: 'hex-st', name: 'Opening', code: 'BOX_OPEN', description: null, is_mandatory: false, typical_duration_hrs: 12.0, sort_order: 20, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-4', organization_id: null, equipment_type_id: 'hex-st', name: 'Bundle Pullout', code: 'BPULL', description: null, is_mandatory: false, typical_duration_hrs: 16.0, sort_order: 30, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-5', organization_id: null, equipment_type_id: 'hex-st', name: 'Cleaning', code: 'CLEAN', description: null, is_mandatory: false, typical_duration_hrs: 16.0, sort_order: 40, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-6', organization_id: null, equipment_type_id: 'hex-st', name: 'Inspection', code: 'INSP', description: null, is_mandatory: false, typical_duration_hrs: 24.0, sort_order: 50, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-7', organization_id: null, equipment_type_id: 'hex-st', name: 'Repair', code: 'REPAIR', description: null, is_mandatory: false, typical_duration_hrs: 40.0, sort_order: 60, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-8', organization_id: null, equipment_type_id: 'hex-st', name: 'Bundle Insertion', code: 'BINST', description: null, is_mandatory: false, typical_duration_hrs: 16.0, sort_order: 70, is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: 'sat-9', organization_id: null, equipment_type_id: 'hex-st', name: 'Box-up', code: 'BOX_CLOSE', description: null, is_mandatory: false, typical_duration_hrs: 12.0, sort_order: 80, is_active: true, created_at: new Date(), updated_at: new Date() },
      ]);

      const suggestions = await ControlledValueResolver.getSuggestedActivitiesForEquipment('HEX-ST');
      expect(suggestions).toHaveLength(9);

      // Verify all items are suggestions (is_enforced: false)
      for (const item of suggestions) {
        expect(item.is_enforced).toBe(false);
        expect(item.provenance).toBe('PLATFORM_DEFAULT');
        expect(item.typical_duration_hours).toBeGreaterThan(0);
        expect(item.suggested_resources).toBeDefined();
      }

      // Verify exact recommended sequence
      expect(suggestions[0].standard_activity_code).toBe('HANDOVER');
      expect(suggestions[1].standard_activity_code).toBe('BLIND');
      expect(suggestions[2].standard_activity_code).toBe('BOX_OPEN');
      expect(suggestions[3].standard_activity_code).toBe('BPULL');
      expect(suggestions[4].standard_activity_code).toBe('CLEAN');
      expect(suggestions[5].standard_activity_code).toBe('INSP');
      expect(suggestions[6].standard_activity_code).toBe('REPAIR');
      expect(suggestions[7].standard_activity_code).toBe('BINST');
      expect(suggestions[8].standard_activity_code).toBe('BOX_CLOSE');
    });
  });

  describe('4. Strict UDF Classification Governance', () => {
    it('should resolve a valid controlled option for a dropdown UDF', async () => {
      vi.mocked(prisma.activityUdfDefinition.findFirst).mockResolvedValue({
        id: 'udf-phase-def-id',
        organization_id: orgId,
        name: 'Work Phase',
        code: 'UDF_WORK_PHASE',
        type: 'select',
        is_mandatory: true,
        is_active: true,
        is_contractor_editable: false,
        contractor_edit_label: null,
        sort_order: 1,
        is_filterable: true,
        is_sortable: true,
        is_groupable: true,
        is_bulk_editable: true,
        validation_rules: null,
        display_order: 1,
        width: 150,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        options: [
          { id: 'opt-prep-id', organization_id: orgId, udf_definition_id: 'udf-phase-def-id', value: 'PREPARATION', label: 'Preparation', code_value: 'PREPARATION', description: null, sort_order: 1, is_active: true, created_by: null, created_at: new Date(), updated_at: new Date(), deleted_at: null },
          { id: 'opt-mech-id', organization_id: orgId, udf_definition_id: 'udf-phase-def-id', value: 'MECHANICAL', label: 'Mechanical', code_value: 'MECHANICAL', description: null, sort_order: 2, is_active: true, created_by: null, created_at: new Date(), updated_at: new Date(), deleted_at: null },
        ],
      } as any);

      const res = await ControlledValueResolver.resolveUdfOption(orgId, 'UDF_WORK_PHASE', 'MECHANICAL');
      expect(res).not.toBeNull();
      expect(res?.option?.id).toBe('opt-mech-id');
      expect(res?.option?.value).toBe('MECHANICAL');
    });

    it('should reject arbitrary free-text classification in a dropdown UDF', async () => {
      vi.mocked(prisma.activityUdfDefinition.findFirst).mockResolvedValue({
        id: 'udf-phase-def-id',
        organization_id: orgId,
        name: 'Work Phase',
        code: 'UDF_WORK_PHASE',
        type: 'select',
        options: [
          { id: 'opt-prep-id', value: 'PREPARATION', code_value: 'PREPARATION', is_active: true, deleted_at: null },
        ],
      } as any);

      await expect(
        ControlledValueResolver.resolveUdfOption(orgId, 'UDF_WORK_PHASE', 'Arbitrary Custom Phase')
      ).rejects.toThrow(ControlledValidationError);

      await expect(
        ControlledValueResolver.resolveUdfOption(orgId, 'UDF_WORK_PHASE', 'Arbitrary Custom Phase')
      ).rejects.toThrow(/Free-text classification is prohibited/);
    });
  });

  describe('5. Plant Hierarchy Integrity Validation', () => {
    it('should validate consistent plant -> unit -> system hierarchy', async () => {
      vi.mocked(prisma.unit.findFirst).mockResolvedValue({
        id: 'unit-cdu1-id',
        plant_id: 'plant-cdu-id',
        area_id: 'area-cdu-id',
        code: 'CDU-1',
        name: 'Atmospheric Crude Distillation',
      } as any);

      vi.mocked(prisma.system.findFirst).mockResolvedValue({
        id: 'sys-pht-id',
        unit_id: 'unit-cdu1-id',
        code: 'CDU-PHT',
        name: 'Crude Preheat Train',
      } as any);

      const res = await ControlledValueResolver.validateHierarchy(orgId, {
        plantId: 'plant-cdu-id',
        areaId: 'area-cdu-id',
        unitId: 'unit-cdu1-id',
        systemId: 'sys-pht-id',
      });

      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('should detect when unit does not belong to specified plant', async () => {
      vi.mocked(prisma.unit.findFirst).mockResolvedValue({
        id: 'unit-cdu1-id',
        plant_id: 'plant-other-id',
        area_id: null,
        code: 'CDU-1',
        name: 'Atmospheric Crude Distillation',
      } as any);

      const res = await ControlledValueResolver.validateHierarchy(orgId, {
        plantId: 'plant-cdu-id',
        unitId: 'unit-cdu1-id',
      });

      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/belongs to plant "plant-other-id", not the specified plant/);
    });
  });

  describe('6. Batch Import Row Validation', () => {
    it('should successfully validate an import row with valid controlled values', async () => {
      vi.mocked(prisma.equipmentType.findFirst).mockResolvedValue({
        id: 'hex-st',
        name: 'Shell & Tube Heat Exchanger',
        code: 'HEX-ST',
      } as any);

      const row = {
        tag_number: 'E-101A',
        equipment_type: 'HEX-ST',
        criticality: 'High',
      };

      const result = await ControlledValueResolver.validateImportRow(orgId, 'asset', row);
      expect(result.valid).toBe(true);
      expect(result.resolved.tag_number).toBe('E-101A');
      expect(result.resolved.equipment_type_id).toBe('hex-st');
      expect(result.resolved.criticality).toBe('high');
    });

    it('should reject an import row with invalid/arbitrary equipment type', async () => {
      vi.mocked(prisma.equipmentType.findFirst).mockResolvedValue(null);

      const row = {
        tag_number: 'E-999',
        equipment_type: 'Arbitrary Homemade Rig',
      };

      const result = await ControlledValueResolver.validateImportRow(orgId, 'asset', row);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/not recognized in the governed equipment master library/);
    });
  });
});
