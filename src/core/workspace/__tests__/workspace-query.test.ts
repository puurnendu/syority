/**
 * M12 V1 Phase 1 — Workspace Query Architectural Tests
 *
 * These tests verify the core architectural contracts of the
 * dimension-aware workspace query layer:
 *
 *   1. System dimensions resolve through canonical relational data
 *   2. UDF dimensions resolve through EAV pattern
 *   3. Both use the same DimensionRegistry contract
 *   4. Tenant isolation (org_id scoping)
 *   5. No authority boundary violations
 *   6. Pagination guarantees
 *   7. Column factory correctness
 *   8. Layout hydration correctness
 *
 * DOES NOT test:
 *   - Actual database queries (use integration tests for that)
 *   - UI rendering (use component tests for that)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DimensionQueryBuilder } from '../DimensionQueryBuilder';
import { SYSTEM_DIMENSION_CODES, SYSTEM_DIMENSIONS } from '@/core/dimensions';
import type { DimensionFilter, DimensionFilterGroup } from '@/core/dimensions';
import type { WorkspaceSort, HierarchyContext } from '../types';
import {
  clampPageSize,
  createDefaultQuery,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from '../types';
import {
  dimensionToColumnConfig,
  dimensionsToColumnConfigs,
  mergeWithExistingColumns,
} from '../columnFactory';
import {
  hydrateLayout,
  createDefaultLayout,
  migrateV1Layout,
} from '../layoutHydration';
import type { ColumnConfig } from '@/stores/useWorkspaceStore';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function unitFilter(unitId: string): DimensionFilter {
  return { dimensionCode: 'UNIT', operator: 'equals', value: unitId };
}

function udfFilter(udfCode: string, value: string): DimensionFilter {
  return { dimensionCode: `UDF_${udfCode}`, operator: 'equals', value };
}

function statusFilter(status: string): DimensionFilter {
  return { dimensionCode: 'STATUS', operator: 'equals', value: status };
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═════════════════════════════════════════════════════════════════════════════

describe('M12 V1 Phase 1 — Workspace Query Architecture', () => {

  // ── Test 1: UNIT filter resolves through canonical relational data ─────

  describe('DimensionQueryBuilder — System Dimension Filters', () => {
    it('1. UNIT filter resolves through workpack.unit_id (canonical FK)', () => {
      const filter = unitFilter('unit-uuid-123');
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).not.toBeNull();
      // Must resolve through workpack → unit_id, NOT through udf_values
      expect(where).toEqual({
        workpack: { unit_id: { equals: 'unit-uuid-123' } },
      });
      // Must NOT contain udf_values
      expect(JSON.stringify(where)).not.toContain('udf_values');
    });

    it('PLANT filter resolves through workpack.plant_id', () => {
      const filter: DimensionFilter = { dimensionCode: 'PLANT', operator: 'equals', value: 'plant-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { plant_id: { equals: 'plant-uuid' } },
      });
    });

    it('SYSTEM filter resolves through workpack.system_id', () => {
      const filter: DimensionFilter = { dimensionCode: 'SYSTEM', operator: 'equals', value: 'sys-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { system_id: { equals: 'sys-uuid' } },
      });
    });

    it('EQUIPMENT filter resolves through workpack.asset_id', () => {
      const filter: DimensionFilter = { dimensionCode: 'EQUIPMENT', operator: 'equals', value: 'asset-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { asset_id: { equals: 'asset-uuid' } },
      });
    });

    it('CONTRACTOR filter resolves through workpack.contractor_id', () => {
      const filter: DimensionFilter = { dimensionCode: 'CONTRACTOR', operator: 'equals', value: 'ctr-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { contractor_id: { equals: 'ctr-uuid' } },
      });
    });

    it('DISCIPLINE filter resolves through activity.discipline_id (direct FK)', () => {
      const filter: DimensionFilter = { dimensionCode: 'DISCIPLINE', operator: 'equals', value: 'disc-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        discipline_id: { equals: 'disc-uuid' },
      });
    });

    it('STATUS filter resolves through activity.status (direct column)', () => {
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(
        statusFilter('in_progress'),
      );

      expect(where).toEqual({
        status: { equals: 'in_progress' },
      });
    });

    it('WBS_CODE filter resolves through activity.wbs_code (direct column)', () => {
      const filter: DimensionFilter = { dimensionCode: 'WBS_CODE', operator: 'contains', value: '01.02' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        wbs_code: { contains: '01.02', mode: 'insensitive' },
      });
    });

    it('AREA filter resolves through workpack → unit → area (2-hop JOIN)', () => {
      const filter: DimensionFilter = { dimensionCode: 'AREA', operator: 'equals', value: 'area-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { unit: { area: { id: { equals: 'area-uuid' } } } },
      });
    });

    it('EQUIPMENT_TYPE filter resolves through workpack → asset.asset_type (2-hop)', () => {
      const filter: DimensionFilter = { dimensionCode: 'EQUIPMENT_TYPE', operator: 'equals', value: 'Pump' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { asset: { asset_type: { equals: 'Pump' } } },
      });
    });

    it('CRITICALITY filter resolves through workpack → asset.criticality (2-hop)', () => {
      const filter: DimensionFilter = { dimensionCode: 'CRITICALITY', operator: 'equals', value: 'High' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { asset: { criticality: { equals: 'High' } } },
      });
    });

    it('PRIORITY filter resolves through workpack.priority', () => {
      const filter: DimensionFilter = { dimensionCode: 'PRIORITY', operator: 'in', value: ['Critical', 'High'] };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        workpack: { priority: { in: ['Critical', 'High'] } },
      });
    });
  });

  // ── Test 2: UDF filter resolves through EAV pattern ────────────────────

  describe('DimensionQueryBuilder — UDF Dimension Filters', () => {
    it('2. UDF filter resolves through ActivityUdfValue EAV pattern', () => {
      const filter = udfFilter('WORK_PHASE', 'Pre-Shutdown');
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).not.toBeNull();
      // Must resolve through udf_values.some(), NOT through workpack
      expect(where).toEqual({
        udf_values: {
          some: {
            udf_definition: { code: 'WORK_PHASE' },
            value_string: { equals: 'Pre-Shutdown' },
          },
        },
      });
    });

    it('UDF "contains" filter uses value_string', () => {
      const filter: DimensionFilter = {
        dimensionCode: 'UDF_AREA_CODE', operator: 'contains', value: 'A-01',
      };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        udf_values: {
          some: {
            udf_definition: { code: 'AREA_CODE' },
            value_string: { contains: 'A-01', mode: 'insensitive' },
          },
        },
      });
    });

    it('UDF numeric filter uses value_number', () => {
      const filter: DimensionFilter = {
        dimensionCode: 'UDF_EST_WEIGHT', operator: 'greater_than', value: 500,
      };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        udf_values: {
          some: {
            udf_definition: { code: 'EST_WEIGHT' },
            value_number: { gt: 500 },
          },
        },
      });
    });

    it('UDF boolean filter uses value_boolean', () => {
      const filter: DimensionFilter = {
        dimensionCode: 'UDF_REQUIRES_PERMIT', operator: 'is_true', value: null,
      };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toEqual({
        udf_values: {
          some: {
            udf_definition: { code: 'REQUIRES_PERMIT' },
            value_boolean: { equals: true },
          },
        },
      });
    });

    it('UDF "is_empty" handles both missing row and null values', () => {
      const filter: DimensionFilter = {
        dimensionCode: 'UDF_NOTES_EXTRA', operator: 'is_empty', value: null,
      };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter)!;

      // Must handle OR: [no row exists, row exists but all values null]
      expect(where).toHaveProperty('OR');
      const orClauses = (where as any).OR;
      expect(orClauses.length).toBe(2);

      // First clause: no UDF row
      expect(orClauses[0]).toHaveProperty('udf_values');
      expect(orClauses[0].udf_values).toHaveProperty('none');

      // Second clause: row exists but values are null
      expect(orClauses[1]).toHaveProperty('udf_values');
      expect(orClauses[1].udf_values).toHaveProperty('some');
    });
  });

  // ── Test 3: Both use the same DimensionRegistry contract ──────────────

  describe('Unified Contract Compliance', () => {
    it('3. System and UDF filters are validated by the same code path', () => {
      // Both should produce valid (non-null) WHERE clauses
      const systemWhere = DimensionQueryBuilder.buildDimensionFilterWhere(
        unitFilter('uuid-1'),
      );
      const udfWhere = DimensionQueryBuilder.buildDimensionFilterWhere(
        udfFilter('WORK_PHASE', 'Phase1'),
      );

      expect(systemWhere).not.toBeNull();
      expect(udfWhere).not.toBeNull();
    });

    it('All system dimension codes have WHERE builders', () => {
      for (const code of SYSTEM_DIMENSION_CODES) {
        const filter: DimensionFilter = { dimensionCode: code, operator: 'equals', value: 'test' };
        const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);
        expect(where).not.toBeNull();
      }
    });

    it('All system dimension codes have ORDER BY builders', () => {
      const { prismaOrderBy } = DimensionQueryBuilder.buildOrderByClause(
        Array.from(SYSTEM_DIMENSION_CODES).map(code => ({
          dimensionCode: code,
          direction: 'asc' as const,
        })),
      );

      // Should have an entry for each system dimension + 2 tiebreakers
      expect(prismaOrderBy.length).toBe(SYSTEM_DIMENSION_CODES.size + 2);
    });
  });

  // ── Test 4: Tenant isolation ──────────────────────────────────────────

  describe('Tenant Isolation', () => {
    it('4. buildWhereClause always includes organization_id scope', () => {
      const where = DimensionQueryBuilder.buildWhereClause({
        organizationId: 'org-A',
        eventId: 'evt-1',
        filters: [],
        filterGroups: [],
      });

      const json = JSON.stringify(where);
      expect(json).toContain('org-A');
    });

    it('buildWhereClause always includes deleted_at: null', () => {
      const where = DimensionQueryBuilder.buildWhereClause({
        organizationId: 'org-A',
        eventId: 'evt-1',
        filters: [],
        filterGroups: [],
      });

      const json = JSON.stringify(where);
      expect(json).toContain('"deleted_at":null');
    });
  });

  // ── Test 5: UNIT cannot be resolved from ActivityUdfValue ─────────────

  describe('Canonical Data Enforcement', () => {
    it('5. UNIT dimension filter does NOT use udf_values path', () => {
      const filter = unitFilter('unit-uuid');
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter)!;

      const json = JSON.stringify(where);
      expect(json).not.toContain('udf_values');
      expect(json).not.toContain('udf_definition');
      expect(json).toContain('unit_id');
    });

    it('PLANT dimension filter does NOT use udf_values path', () => {
      const filter: DimensionFilter = { dimensionCode: 'PLANT', operator: 'equals', value: 'plant-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter)!;

      expect(JSON.stringify(where)).not.toContain('udf_values');
    });

    it('SYSTEM dimension filter does NOT use udf_values path', () => {
      const filter: DimensionFilter = { dimensionCode: 'SYSTEM', operator: 'equals', value: 'sys-uuid' };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter)!;

      expect(JSON.stringify(where)).not.toContain('udf_values');
    });
  });

  // ── Test 6: Dimension code cannot inject arbitrary Prisma fields ──────

  describe('Security — Injection Prevention', () => {
    it('6. Unknown dimension code is silently skipped (returns null)', () => {
      const filter: DimensionFilter = {
        dimensionCode: 'MALICIOUS_FIELD; DROP TABLE',
        operator: 'equals',
        value: 'test',
      };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toBeNull();
    });

    it('Invented system code is rejected', () => {
      const filter: DimensionFilter = {
        dimensionCode: 'FAKE_DIMENSION',
        operator: 'equals',
        value: 'test',
      };
      const where = DimensionQueryBuilder.buildDimensionFilterWhere(filter);

      expect(where).toBeNull();
    });

    it('validateFilterCodes identifies unknown codes', () => {
      const invalid = DimensionQueryBuilder.validateFilterCodes([
        'UNIT', 'SYSTEM', 'UNKNOWN_CODE', 'UDF_VALID', 'ANOTHER_INVALID',
      ]);

      expect(invalid).toEqual(['UNKNOWN_CODE', 'ANOTHER_INVALID']);
    });
  });

  // ── Test 7: Sorting only allows registered sortable dimensions ────────

  describe('Sort Validation', () => {
    it('7. validateSortCodes rejects non-sortable dimensions', () => {
      const dimMap = new Map<string, { sortable: boolean }>([
        ['UNIT', { sortable: true }],
        ['STATUS', { sortable: true }],
        ['LOCKED_DIM', { sortable: false }],
      ]);

      const invalid = DimensionQueryBuilder.validateSortCodes(
        [
          { dimensionCode: 'UNIT', direction: 'asc' },
          { dimensionCode: 'STATUS', direction: 'desc' },
          { dimensionCode: 'LOCKED_DIM', direction: 'asc' },
          { dimensionCode: 'UNKNOWN', direction: 'asc' },
        ],
        dimMap,
      );

      expect(invalid).toContain('LOCKED_DIM');
      expect(invalid).toContain('UNKNOWN');
      expect(invalid).not.toContain('UNIT');
      expect(invalid).not.toContain('STATUS');
    });

    it('UDF sort is deferred to in-memory (not in prismaOrderBy)', () => {
      const sorts: WorkspaceSort[] = [
        { dimensionCode: 'UNIT', direction: 'asc' },
        { dimensionCode: 'UDF_WORK_PHASE', direction: 'desc' },
      ];

      const { prismaOrderBy, inMemoryUdfSorts } =
        DimensionQueryBuilder.buildOrderByClause(sorts);

      // UNIT should be in prismaOrderBy, UDF should be in inMemoryUdfSorts
      expect(inMemoryUdfSorts.length).toBe(1);
      expect(inMemoryUdfSorts[0].dimensionCode).toBe('UDF_WORK_PHASE');

      // prismaOrderBy should include UNIT + 2 tiebreakers
      expect(prismaOrderBy.length).toBe(3);
    });
  });

  // ── Test 8: Grouping only allows registered groupable dimensions ──────

  describe('Group-By Validation', () => {
    it('8. validateGroupByCodes rejects non-groupable dimensions', () => {
      const dimMap = new Map<string, { groupable: boolean }>([
        ['UNIT', { groupable: true }],
        ['NON_GROUP', { groupable: false }],
      ]);

      const invalid = DimensionQueryBuilder.validateGroupByCodes(
        ['UNIT', 'NON_GROUP', 'MISSING'],
        dimMap,
      );

      expect(invalid).toContain('NON_GROUP');
      expect(invalid).toContain('MISSING');
      expect(invalid).not.toContain('UNIT');
    });
  });

  // ── Test 9: Saved layouts persist dimension codes ─────────────────────

  describe('Saved Layout — Dimension Code Persistence', () => {
    it('9. createDefaultLayout generates dimension codes from registry', () => {
      const layout = createDefaultLayout(SYSTEM_DIMENSIONS as any);

      expect(layout.version).toBe(2);
      expect(layout.columns.length).toBe(SYSTEM_DIMENSIONS.length);

      // Every column has a dimensionCode
      for (const col of layout.columns) {
        expect(col.dimensionCode).toBeDefined();
        expect(col.dimensionCode.length).toBeGreaterThan(0);
      }
    });

    it('System dimensions are visible by default, UDFs are hidden', () => {
      const mockDims = [
        { ...SYSTEM_DIMENSIONS[0], systemDefined: true },
        { code: 'UDF_TEST', label: 'Test', systemDefined: false, width: 100,
          dataType: 'text' as const, source: 'ACTIVITY_UDF' as const,
          filterable: true, sortable: true, groupable: true,
          exportable: true, bulkEditable: false, displayOrder: 1000 },
      ];

      const layout = createDefaultLayout(mockDims as any);

      expect(layout.columns[0].visible).toBe(true);  // System
      expect(layout.columns[1].visible).toBe(false); // UDF
    });
  });

  // ── Test 10: Unknown/deactivated dimensions handled safely ────────────

  describe('Layout Hydration — Graceful Degradation', () => {
    it('10. hydrateLayout drops deactivated UDF dimension codes', () => {
      const savedLayout = {
        version: 2 as const,
        name: 'My Layout',
        columns: [
          { dimensionCode: 'UNIT', label: 'Unit', width: 150, visible: true, frozen: false },
          { dimensionCode: 'UDF_DELETED_FIELD', label: 'Old UDF', width: 100, visible: true, frozen: false },
          { dimensionCode: 'STATUS', label: 'Status', width: 120, visible: true, frozen: false },
        ],
        sort: [],
        groupBy: [],
        scope: 'personal' as const,
      };

      // Available dimensions (UDF_DELETED_FIELD is not here)
      const available = [
        SYSTEM_DIMENSIONS.find(d => d.code === 'UNIT')!,
        SYSTEM_DIMENSIONS.find(d => d.code === 'STATUS')!,
      ];

      const { columns, droppedCodes, newCodes } = hydrateLayout(savedLayout, available as any);

      expect(droppedCodes).toContain('UDF_DELETED_FIELD');
      expect(columns.length).toBe(2); // Only UNIT and STATUS remain
      expect(columns[0].dimensionCode).toBe('UNIT');
      expect(columns[1].dimensionCode).toBe('STATUS');
    });

    it('hydrateLayout appends newly-added dimensions (hidden)', () => {
      const savedLayout = {
        version: 2 as const,
        name: 'Old Layout',
        columns: [
          { dimensionCode: 'UNIT', label: 'Unit', width: 150, visible: true, frozen: false },
        ],
        sort: [],
        groupBy: [],
        scope: 'personal' as const,
      };

      const available = [
        SYSTEM_DIMENSIONS.find(d => d.code === 'UNIT')!,
        SYSTEM_DIMENSIONS.find(d => d.code === 'STATUS')!,
        SYSTEM_DIMENSIONS.find(d => d.code === 'WBS_CODE')!,
      ];

      const { columns, newCodes } = hydrateLayout(savedLayout, available as any);

      expect(newCodes).toContain('STATUS');
      expect(newCodes).toContain('WBS_CODE');
      expect(columns.length).toBe(3);
      // New columns should be hidden
      expect(columns[1].visible).toBe(false);
      expect(columns[2].visible).toBe(false);
    });

    it('hydrateLayout preserves user-customized widths', () => {
      const savedLayout = {
        version: 2 as const,
        name: 'Custom',
        columns: [
          { dimensionCode: 'UNIT', label: 'My Unit', width: 250, visible: true, frozen: true },
        ],
        sort: [],
        groupBy: [],
        scope: 'personal' as const,
      };

      const available = [SYSTEM_DIMENSIONS.find(d => d.code === 'UNIT')!];

      const { columns } = hydrateLayout(savedLayout, available as any);

      expect(columns[0].width).toBe(250); // Preserved, not overwritten
      expect(columns[0].frozen).toBe(true);
    });
  });

  // ── Test 11: Server-side pagination returns bounded rows ──────────────

  describe('Pagination Guarantees', () => {
    it('11. clampPageSize enforces MIN/MAX bounds', () => {
      expect(clampPageSize(5)).toBe(MIN_PAGE_SIZE);
      expect(clampPageSize(10000)).toBe(MAX_PAGE_SIZE);
      expect(clampPageSize(100)).toBe(100);
      expect(clampPageSize(0)).toBe(MIN_PAGE_SIZE);
      expect(clampPageSize(-1)).toBe(MIN_PAGE_SIZE);
    });

    it('createDefaultQuery has sensible defaults', () => {
      const q = createDefaultQuery('org-1', 'evt-1');

      expect(q.organizationId).toBe('org-1');
      expect(q.eventId).toBe('evt-1');
      expect(q.page).toBe(1);
      expect(q.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(q.filters).toEqual([]);
      expect(q.sort).toEqual([]);
      expect(q.groupBy).toEqual([]);
      expect(q.dimensions).toEqual([]);
    });

    it('DEFAULT_PAGE_SIZE is within valid range', () => {
      expect(DEFAULT_PAGE_SIZE).toBeGreaterThanOrEqual(MIN_PAGE_SIZE);
      expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    });
  });

  // ── Test 13: No progress calculation in workspace layer ───────────────

  describe('Authority Boundary Compliance', () => {
    it('13. Workspace module files do not import M8.13 progress services', () => {
      const workspaceDir = path.resolve(__dirname, '..');
      const files = fs.readdirSync(workspaceDir).filter(f => f.endsWith('.ts'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(workspaceDir, file), 'utf-8');
        // Must NOT import progress calculation services
        expect(content).not.toContain('ProgressAggregationService');
        expect(content).not.toContain('progress_percent');
        expect(content).not.toContain('calculateProgress');
      }
    });

    it('14. Workspace module files do not import M11 schedule calculation', () => {
      const workspaceDir = path.resolve(__dirname, '..');
      const files = fs.readdirSync(workspaceDir).filter(f => f.endsWith('.ts'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(workspaceDir, file), 'utf-8');
        // Must NOT import schedule calculation services
        expect(content).not.toContain('ScheduleEngine');
        expect(content).not.toContain('CpmCalculation');
        expect(content).not.toContain('forwardPass');
        expect(content).not.toContain('backwardPass');
      }
    });

    it('Workspace types mark schedule fields as read-only (by convention)', () => {
      // Verify the WorkspaceRow type file contains read-only schedule field comments
      const typesPath = path.resolve(__dirname, '..', 'types.ts');
      const content = fs.readFileSync(typesPath, 'utf-8');

      expect(content).toContain('read-only');
      expect(content).toContain('M11 authority');
    });
  });

  // ── Test 15: Column factory correctness ───────────────────────────────

  describe('Column Factory', () => {
    it('15. dimensionToColumnConfig maps DimensionDefinition to ColumnConfig', () => {
      const dim = SYSTEM_DIMENSIONS.find(d => d.code === 'UNIT')!;
      const col = dimensionToColumnConfig(dim as any);

      expect(col.key).toBe('UNIT');
      expect(col.dimensionCode).toBe('UNIT');
      expect(col.label).toBe('Unit');
      expect(col.width).toBe(dim.width);
      expect(col.visible).toBe(true); // System = visible
      expect(col.isUdf).toBe(false);
    });

    it('UDF dimension produces isUdf: true with udfCode', () => {
      const udfDim = {
        code: 'UDF_WORK_PHASE',
        label: 'Work Phase',
        dataType: 'dropdown' as const,
        source: 'ACTIVITY_UDF' as const,
        systemDefined: false,
        filterable: true,
        sortable: true,
        groupable: true,
        exportable: true,
        bulkEditable: false,
        displayOrder: 1000,
        width: 150,
      };

      const col = dimensionToColumnConfig(udfDim as any);

      expect(col.isUdf).toBe(true);
      expect(col.udfCode).toBe('WORK_PHASE');
      expect(col.udfType).toBe('dropdown');
      expect(col.visible).toBe(false); // UDF = hidden by default
    });

    it('dimensionsToColumnConfigs converts array and preserves order', () => {
      const dims = [
        SYSTEM_DIMENSIONS.find(d => d.code === 'UNIT')!,
        SYSTEM_DIMENSIONS.find(d => d.code === 'STATUS')!,
      ];

      const cols = dimensionsToColumnConfigs(dims as any);

      expect(cols.length).toBe(2);
      expect(cols[0].dimensionCode).toBe('UNIT');
      expect(cols[1].dimensionCode).toBe('STATUS');
    });

    it('mergeWithExistingColumns preserves user customizations', () => {
      const existing: ColumnConfig[] = [
        { key: 'UNIT', label: 'My Custom Unit Label', width: 300, visible: true, frozen: true, dimensionCode: 'UNIT' },
      ];

      const dims = [
        SYSTEM_DIMENSIONS.find(d => d.code === 'UNIT')!,
        SYSTEM_DIMENSIONS.find(d => d.code === 'STATUS')!,
      ];

      const { columns, removedKeys } = mergeWithExistingColumns(existing, dims as any);

      expect(columns.length).toBe(2);
      expect(columns[0].label).toBe('My Custom Unit Label'); // Preserved
      expect(columns[0].width).toBe(300); // Preserved
      expect(columns[0].frozen).toBe(true); // Preserved
      expect(columns[1].dimensionCode).toBe('STATUS'); // New
      expect(columns[1].visible).toBe(false); // New = hidden
      expect(removedKeys).toEqual([]);
    });

    it('mergeWithExistingColumns removes orphaned columns', () => {
      const existing: ColumnConfig[] = [
        { key: 'UNIT', label: 'Unit', width: 150, visible: true, frozen: false, dimensionCode: 'UNIT' },
        { key: 'UDF_DELETED', label: 'Old', width: 100, visible: true, frozen: false, dimensionCode: 'UDF_DELETED' },
      ];

      const dims = [SYSTEM_DIMENSIONS.find(d => d.code === 'UNIT')!];

      const { columns, removedKeys } = mergeWithExistingColumns(existing, dims as any);

      expect(columns.length).toBe(1);
      expect(removedKeys).toContain('UDF_DELETED');
    });
  });

  // ── Test 16: Layout V1 → V2 migration ─────────────────────────────────

  describe('Layout Migration', () => {
    it('16. migrateV1Layout maps old field keys to dimension codes', () => {
      const v1Cols = [
        { key: 'wbs_code', label: 'WBS', width: 90, visible: true, frozen: false },
        { key: 'status', label: 'Status', width: 80, visible: true, frozen: false },
        { key: 'priority', label: 'Priority', width: 100, visible: true, frozen: false },
      ];

      const migrated = migrateV1Layout(v1Cols);

      expect(migrated.length).toBe(3);
      expect(migrated[0].dimensionCode).toBe('WBS_CODE');
      expect(migrated[1].dimensionCode).toBe('STATUS');
      expect(migrated[2].dimensionCode).toBe('PRIORITY');
    });

    it('migrateV1Layout handles UDF columns', () => {
      const v1Cols = [
        { key: 'udf_work_phase', label: 'Work Phase', width: 130, visible: true, frozen: false, isUdf: true, udfCode: 'WORK_PHASE' },
      ];

      const migrated = migrateV1Layout(v1Cols);

      expect(migrated.length).toBe(1);
      expect(migrated[0].dimensionCode).toBe('UDF_WORK_PHASE');
    });

    it('migrateV1Layout drops unrecognized keys', () => {
      const v1Cols = [
        { key: 'random_field', label: 'Random', width: 100, visible: true, frozen: false },
      ];

      const migrated = migrateV1Layout(v1Cols);

      expect(migrated.length).toBe(0);
    });
  });

  // ── Test 17: HierarchyContext maps to correct Prisma where ────────────

  describe('Hierarchy Context → Prisma WHERE', () => {
    it('17. workpackId maps to activity.workpack_id (most specific)', () => {
      const ctx: HierarchyContext = { unitId: 'u1', workpackId: 'wp1' };
      const where = DimensionQueryBuilder.buildHierarchyWhere(ctx);

      // workpackId should take precedence over unitId
      expect(where).toEqual({ workpack_id: 'wp1' });
    });

    it('unitId maps to workpack.unit_id', () => {
      const ctx: HierarchyContext = { unitId: 'u1' };
      const where = DimensionQueryBuilder.buildHierarchyWhere(ctx);

      expect(where).toEqual({ workpack: { unit_id: 'u1' } });
    });

    it('plantId maps to workpack.plant_id', () => {
      const ctx: HierarchyContext = { plantId: 'p1' };
      const where = DimensionQueryBuilder.buildHierarchyWhere(ctx);

      expect(where).toEqual({ workpack: { plant_id: 'p1' } });
    });

    it('systemId maps to workpack.system_id', () => {
      const ctx: HierarchyContext = { systemId: 's1' };
      const where = DimensionQueryBuilder.buildHierarchyWhere(ctx);

      expect(where).toEqual({ workpack: { system_id: 's1' } });
    });

    it('assetId maps to workpack.asset_id', () => {
      const ctx: HierarchyContext = { assetId: 'a1' };
      const where = DimensionQueryBuilder.buildHierarchyWhere(ctx);

      expect(where).toEqual({ workpack: { asset_id: 'a1' } });
    });

    it('areaId maps through workpack → unit → area', () => {
      const ctx: HierarchyContext = { areaId: 'area1' };
      const where = DimensionQueryBuilder.buildHierarchyWhere(ctx);

      expect(where).toEqual({ workpack: { unit: { area: { id: 'area1' } } } });
    });

    it('Empty context returns empty object', () => {
      const ctx: HierarchyContext = {};
      const where = DimensionQueryBuilder.buildHierarchyWhere(ctx);

      expect(where).toEqual({});
    });
  });

  // ── Test 18: Filter group composition ─────────────────────────────────

  describe('Filter Group Composition', () => {
    it('18. AND filter group combines all conditions', () => {
      const group: DimensionFilterGroup = {
        operator: 'AND',
        conditions: [
          statusFilter('in_progress'),
          unitFilter('unit-1'),
        ],
      };

      const where = DimensionQueryBuilder.buildFilterGroupWhere(group);

      expect(where).not.toBeNull();
      expect(where).toHaveProperty('AND');
      expect((where as any).AND.length).toBe(2);
    });

    it('OR filter group uses OR combinator', () => {
      const group: DimensionFilterGroup = {
        operator: 'OR',
        conditions: [
          statusFilter('completed'),
          statusFilter('in_progress'),
        ],
      };

      const where = DimensionQueryBuilder.buildFilterGroupWhere(group);

      expect(where).not.toBeNull();
      expect(where).toHaveProperty('OR');
      expect((where as any).OR.length).toBe(2);
    });

    it('Nested filter groups are supported (recursive)', () => {
      const group: DimensionFilterGroup = {
        operator: 'AND',
        conditions: [
          unitFilter('unit-1'),
          {
            operator: 'OR',
            conditions: [
              statusFilter('completed'),
              statusFilter('in_progress'),
            ],
          },
        ],
      };

      const where = DimensionQueryBuilder.buildFilterGroupWhere(group);

      expect(where).not.toBeNull();
      const and = (where as any).AND;
      expect(and.length).toBe(2);
      expect(and[1]).toHaveProperty('OR');
    });

    it('Empty conditions produce null', () => {
      const group: DimensionFilterGroup = { operator: 'AND', conditions: [] };
      const where = DimensionQueryBuilder.buildFilterGroupWhere(group);

      expect(where).toBeNull();
    });
  });

  // ── Test 19: buildWhereClause composes all filters ────────────────────

  describe('Full WHERE Clause Composition', () => {
    it('Composes filters + hierarchy + search into single WHERE', () => {
      const where = DimensionQueryBuilder.buildWhereClause({
        organizationId: 'org-1',
        eventId: 'evt-1',
        filters: [statusFilter('in_progress')],
        filterGroups: [],
        hierarchyContext: { unitId: 'unit-1' },
        search: 'valve',
      });

      const json = JSON.stringify(where);

      // Must contain org scope
      expect(json).toContain('org-1');
      // Must contain event scope
      expect(json).toContain('evt-1');
      // Must contain status filter
      expect(json).toContain('in_progress');
      // Must contain hierarchy
      expect(json).toContain('unit-1');
      // Must contain search
      expect(json).toContain('valve');
    });

    it('ORDER BY always includes tiebreaker (deterministic pagination)', () => {
      const { prismaOrderBy } = DimensionQueryBuilder.buildOrderByClause([]);

      // Even with no sort specs, should have tiebreakers
      expect(prismaOrderBy.length).toBe(2);
      expect(prismaOrderBy[0]).toEqual({ workpack_id: 'asc' });
      expect(prismaOrderBy[1]).toEqual({ sequence_number: 'asc' });
    });
  });

  // ── Test 20: Text search across multiple fields ───────────────────────

  describe('Text Search', () => {
    it('Search generates OR across activity_id, description, wbs_code', () => {
      const where = DimensionQueryBuilder.buildWhereClause({
        organizationId: 'org-1',
        eventId: 'evt-1',
        filters: [],
        filterGroups: [],
        search: 'valve replacement',
      });

      const json = JSON.stringify(where);
      expect(json).toContain('activity_id');
      expect(json).toContain('description');
      expect(json).toContain('wbs_code');
      expect(json).toContain('valve replacement');
    });

    it('Empty/whitespace search is ignored', () => {
      const where = DimensionQueryBuilder.buildWhereClause({
        organizationId: 'org-1',
        eventId: 'evt-1',
        filters: [],
        filterGroups: [],
        search: '   ',
      });

      // Should be just the base scope (no OR search clause)
      expect(where).toEqual({
        organization_id: 'org-1',
        event_id: 'evt-1',
        deleted_at: null,
      });
    });
  });
});
