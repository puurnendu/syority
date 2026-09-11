/**
 * Platform Dimension Registry — Architectural Verification Tests
 *
 * PURPOSE: Prove the Dimension Registry contract is correctly implemented.
 *
 * These tests are architectural verification tests, NOT unit tests.
 * They verify:
 *   - Test A: UDF dimensions expose DimensionDefinition with filter/sort/group metadata
 *   - Test B: System dimensions expose the same DimensionDefinition contract
 *   - Test C: System dimensions resolve from canonical relational data, NOT from UDF tables
 *   - Test D: Saved configurations reference dimension codes, not column positions
 *   - Test E: No progress calculation logic exists in dimensions module
 *   - Test F: No CPM/schedule logic exists in dimensions module
 *   - Test G: DimensionResolver handles missing relations gracefully
 *   - Test H: System and UDF dimension codes are collision-free
 *   - Test I: All system dimensions have required contract fields
 *   - Test J: DimensionRegistry API endpoint exists
 *
 * DOES NOT test: M12 V1 features, execution workspace UI, offline sync, AI
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../../..');
const PRISMA_SCHEMA = path.join(SRC_ROOT, 'prisma', 'schema.prisma');
const DIMENSIONS_DIR = path.resolve(__dirname, '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), 'utf-8');
}

function findAllFiles(dir: string, ext: string, results: string[] = []): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      if (entry.name === '__tests__') continue;
      if (entry.isDirectory()) {
        findAllFiles(fullPath, ext, results);
      } else if (entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return results;
}

// ============================================================================
// SCHEMA TESTS — ActivityUdfDefinition dimension metadata
// ============================================================================

describe('SCHEMA — ActivityUdfDefinition dimension metadata', () => {
  const schema = readFile('prisma/schema.prisma');

  test('ActivityUdfDefinition has is_filterable field', () => {
    const model = schema.match(/model ActivityUdfDefinition \{[\s\S]*?\n\}/);
    expect(model).not.toBeNull();
    expect(model![0]).toContain('is_filterable');
  });

  test('ActivityUdfDefinition has is_sortable field', () => {
    const model = schema.match(/model ActivityUdfDefinition \{[\s\S]*?\n\}/);
    expect(model![0]).toContain('is_sortable');
  });

  test('ActivityUdfDefinition has is_groupable field', () => {
    const model = schema.match(/model ActivityUdfDefinition \{[\s\S]*?\n\}/);
    expect(model![0]).toContain('is_groupable');
  });

  test('ActivityUdfDefinition has is_bulk_editable field', () => {
    const model = schema.match(/model ActivityUdfDefinition \{[\s\S]*?\n\}/);
    expect(model![0]).toContain('is_bulk_editable');
  });

  test('ActivityUdfDefinition has display_order field', () => {
    const model = schema.match(/model ActivityUdfDefinition \{[\s\S]*?\n\}/);
    expect(model![0]).toContain('display_order');
  });

  test('ActivityUdfDefinition has width field', () => {
    const model = schema.match(/model ActivityUdfDefinition \{[\s\S]*?\n\}/);
    expect(model![0]).toContain('width');
  });

  test('ActivityUdfDefinition has validation_rules field', () => {
    const model = schema.match(/model ActivityUdfDefinition \{[\s\S]*?\n\}/);
    expect(model![0]).toContain('validation_rules');
  });
});

// ============================================================================
// TEST A — UDF DimensionDefinition contract
// ============================================================================

describe('TEST A — UDF DimensionDefinition contract', () => {
  test('types.ts exports DimensionDefinition with all required fields', () => {
    const typesContent = fs.readFileSync(path.join(DIMENSIONS_DIR, 'types.ts'), 'utf-8');

    // Core contract fields
    expect(typesContent).toContain('code: string');
    expect(typesContent).toContain('label: string');
    expect(typesContent).toContain('dataType: DimensionDataType');
    expect(typesContent).toContain('source: DimensionSource');
    expect(typesContent).toContain('systemDefined: boolean');
    expect(typesContent).toContain('filterable: boolean');
    expect(typesContent).toContain('sortable: boolean');
    expect(typesContent).toContain('groupable: boolean');
    expect(typesContent).toContain('exportable: boolean');
    expect(typesContent).toContain('bulkEditable: boolean');
    expect(typesContent).toContain('displayOrder: number');
    expect(typesContent).toContain('width: number');
  });

  test('DimensionSource includes ACTIVITY_UDF', () => {
    const typesContent = fs.readFileSync(path.join(DIMENSIONS_DIR, 'types.ts'), 'utf-8');
    expect(typesContent).toContain("'ACTIVITY_UDF'");
  });

  test('DimensionRegistry maps UDF definitions with UDF_ prefix', () => {
    const registryContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionRegistry.ts'),
      'utf-8',
    );
    expect(registryContent).toContain('`UDF_${udf.code}`');
  });
});

// ============================================================================
// TEST B — System DimensionDefinition contract
// ============================================================================

describe('TEST B — System dimensions expose same contract as UDFs', () => {
  test('SystemDimensionCatalog exports SYSTEM_DIMENSIONS array', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );
    expect(catalogContent).toContain('export const SYSTEM_DIMENSIONS');
  });

  test('UNIT system dimension exists with required contract fields', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );

    // Must have UNIT dimension
    expect(catalogContent).toContain("code: 'UNIT'");
    // Must specify source
    expect(catalogContent).toContain("source: 'DIGITAL_PLANT'");
    // Must have all contract fields
    expect(catalogContent).toContain('filterable: true');
    expect(catalogContent).toContain('sortable: true');
    expect(catalogContent).toContain('groupable: true');
    expect(catalogContent).toContain('exportable: true');
  });

  const REQUIRED_SYSTEM_DIMENSIONS = [
    'EVENT', 'SITE', 'PLANT', 'AREA', 'UNIT', 'SYSTEM',
    'EQUIPMENT', 'EQUIPMENT_TYPE', 'WORKPACK', 'DISCIPLINE',
    'CONTRACTOR', 'PRIORITY', 'CRITICALITY', 'STATUS',
    'WBS_CODE', 'WORK_CATEGORY',
  ];

  for (const dim of REQUIRED_SYSTEM_DIMENSIONS) {
    test(`system dimension ${dim} is registered`, () => {
      const catalogContent = fs.readFileSync(
        path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
        'utf-8',
      );
      expect(catalogContent).toContain(`code: '${dim}'`);
    });
  }
});

// ============================================================================
// TEST C — Canonical storage (system dims resolve from relational data)
// ============================================================================

describe('TEST C — UNIT resolves from Digital Plant, NOT from ActivityUdfValue', () => {
  test('DimensionResolver resolves UNIT from workpack.unit relation', () => {
    const resolverContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionResolver.ts'),
      'utf-8',
    );

    // Must resolve UNIT from workpack relation, not from UDF tables
    expect(resolverContent).toContain("case 'UNIT':");
    expect(resolverContent).toContain('wp?.unit?.id');
    expect(resolverContent).toContain('wp?.unit?.code');
    expect(resolverContent).toContain('wp?.unit?.name');
  });

  test('DimensionResolver resolves CONTRACTOR from workpack.contractor relation', () => {
    const resolverContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionResolver.ts'),
      'utf-8',
    );
    expect(resolverContent).toContain("case 'CONTRACTOR':");
    expect(resolverContent).toContain('wp?.contractor?.name');
  });

  test('DimensionResolver resolves DISCIPLINE from activity.discipline relation', () => {
    const resolverContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionResolver.ts'),
      'utf-8',
    );
    expect(resolverContent).toContain("case 'DISCIPLINE':");
    expect(resolverContent).toContain('activity.discipline?.code');
  });

  test('UNIT is typed as DIGITAL_PLANT source, not ACTIVITY_UDF', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );
    // Find the UNIT block and verify its source
    const unitBlock = catalogContent.match(/code: 'UNIT'[\s\S]*?source: '([^']+)'/);
    expect(unitBlock).not.toBeNull();
    expect(unitBlock![1]).toBe('DIGITAL_PLANT');
  });
});

// ============================================================================
// TEST D — Stable codes for saved configurations
// ============================================================================

describe('TEST D — Dimension codes are stable strings, not positional', () => {
  test('system dimension codes are string constants', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );
    // All codes must be string literals, not numeric indices
    const codeMatches = catalogContent.matchAll(/code: '([A-Z_]+)'/g);
    const codes = Array.from(codeMatches, (m) => m[1]);
    expect(codes.length).toBeGreaterThanOrEqual(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z][A-Z_]+$/);
    }
  });

  test('UDF dimension codes are prefixed with UDF_', () => {
    const registryContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionRegistry.ts'),
      'utf-8',
    );
    // Registry must prefix UDF codes
    expect(registryContent).toContain("code: `UDF_${udf.code}`");
  });

  test('SYSTEM_DIMENSION_CODES set exported for O(1) lookups', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );
    expect(catalogContent).toContain('export const SYSTEM_DIMENSION_CODES');
    expect(catalogContent).toContain('new Set(');
  });
});

// ============================================================================
// TEST E — No progress calculation in dimensions module
// ============================================================================

describe('TEST E — Dimensions module does NOT calculate progress', () => {
  test('no progress calculation imports', () => {
    const files = findAllFiles(DIMENSIONS_DIR, '.ts');
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('ProgressAggregationService');
      expect(content).not.toContain('ProgressCalculationService');
      expect(content).not.toContain('syncWorkpackProgress');
    }
  });

  test('no progress_percent or overall_progress mutation', () => {
    const files = findAllFiles(DIMENSIONS_DIR, '.ts');
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/progress_percent\s*=/);
      expect(content).not.toMatch(/overall_progress\s*=/);
    }
  });
});

// ============================================================================
// TEST F — No CPM/schedule logic in dimensions module
// ============================================================================

describe('TEST F — Dimensions module does NOT contain CPM logic', () => {
  test('no CPM/schedule imports', () => {
    const files = findAllFiles(DIMENSIONS_DIR, '.ts');
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('CpmEngine');
      expect(content).not.toContain('ScheduleEngine');
      expect(content).not.toContain('criticalPath');
      expect(content).not.toContain('forward_pass');
      expect(content).not.toContain('backward_pass');
    }
  });

  test('no schedule field mutations', () => {
    const files = findAllFiles(DIMENSIONS_DIR, '.ts');
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/early_start\s*=/);
      expect(content).not.toMatch(/early_finish\s*=/);
      expect(content).not.toMatch(/late_start\s*=/);
      expect(content).not.toMatch(/late_finish\s*=/);
      expect(content).not.toMatch(/total_float\s*=/);
    }
  });
});

// ============================================================================
// TEST G — DimensionResolver handles missing relations gracefully
// ============================================================================

describe('TEST G — DimensionResolver graceful degradation', () => {
  test('resolver uses optional chaining for all workpack relations', () => {
    const resolverContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionResolver.ts'),
      'utf-8',
    );
    // Must use ?. for workpack and its children
    expect(resolverContent).toContain('wp?.plant');
    expect(resolverContent).toContain('wp?.unit');
    expect(resolverContent).toContain('wp?.system');
    expect(resolverContent).toContain('wp?.asset');
    expect(resolverContent).toContain('wp?.contractor');
  });

  test('resolver returns empty string label for null values', () => {
    const resolverContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionResolver.ts'),
      'utf-8',
    );
    // All resolution branches must handle null → empty string
    const emptyLabelCount = (resolverContent.match(/label: .+\?\? ''/g) || []).length;
    expect(emptyLabelCount).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================================
// TEST H — System and UDF codes are collision-free
// ============================================================================

describe('TEST H — No code collision between system and UDF dimensions', () => {
  test('UDF codes are prefixed with UDF_ to prevent collision', () => {
    const registryContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'DimensionRegistry.ts'),
      'utf-8',
    );
    // UDF codes must be prefixed
    expect(registryContent).toContain("code: `UDF_${udf.code}`");
    // System dimension lookup checks the prefix
    expect(registryContent).toContain("code.startsWith('UDF_')");
  });

  test('no system dimension code starts with UDF_', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );
    const codeMatches = catalogContent.matchAll(/code: '([A-Z_]+)'/g);
    const codes = Array.from(codeMatches, (m) => m[1]);
    for (const code of codes) {
      expect(code).not.toMatch(/^UDF_/);
    }
  });
});

// ============================================================================
// TEST I — All system dimensions have required contract fields
// ============================================================================

describe('TEST I — Every system dimension satisfies DimensionDefinition', () => {
  const REQUIRED_FIELDS = [
    'code', 'label', 'dataType', 'source', 'systemDefined',
    'filterable', 'sortable', 'groupable', 'exportable',
    'bulkEditable', 'displayOrder', 'width',
  ];

  test('SystemDimensionCatalog DimensionDefinition type import', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );
    expect(catalogContent).toContain("import type { DimensionDefinition }");
  });

  test('SYSTEM_DIMENSIONS array is typed as DimensionDefinition[]', () => {
    const catalogContent = fs.readFileSync(
      path.join(DIMENSIONS_DIR, 'SystemDimensionCatalog.ts'),
      'utf-8',
    );
    expect(catalogContent).toContain('readonly DimensionDefinition[]');
  });
});

// ============================================================================
// TEST J — API endpoint exists
// ============================================================================

describe('TEST J — Dimension API endpoint exists', () => {
  test('GET /api/workspace/dimensions route file exists', () => {
    const routePath = path.join(SRC_ROOT, 'app', 'api', 'workspace', 'dimensions', 'route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  test('route imports DimensionRegistry', () => {
    const routeContent = readFile('app/api/workspace/dimensions/route.ts');
    expect(routeContent).toContain('DimensionRegistry');
    expect(routeContent).toContain('getDefinitions');
  });

  test('route uses organization_id from session', () => {
    const routeContent = readFile('app/api/workspace/dimensions/route.ts');
    expect(routeContent).toContain('organization_id');
  });
});

// ============================================================================
// TEST K — Module barrel export completeness
// ============================================================================

describe('TEST K — Barrel export completeness', () => {
  test('index.ts exports DimensionRegistry', () => {
    const indexContent = fs.readFileSync(path.join(DIMENSIONS_DIR, 'index.ts'), 'utf-8');
    expect(indexContent).toContain('DimensionRegistry');
  });

  test('index.ts exports DimensionResolver', () => {
    const indexContent = fs.readFileSync(path.join(DIMENSIONS_DIR, 'index.ts'), 'utf-8');
    expect(indexContent).toContain('DimensionResolver');
  });

  test('index.ts exports SYSTEM_DIMENSIONS', () => {
    const indexContent = fs.readFileSync(path.join(DIMENSIONS_DIR, 'index.ts'), 'utf-8');
    expect(indexContent).toContain('SYSTEM_DIMENSIONS');
  });

  test('index.ts exports DimensionDefinition type', () => {
    const indexContent = fs.readFileSync(path.join(DIMENSIONS_DIR, 'index.ts'), 'utf-8');
    expect(indexContent).toContain('DimensionDefinition');
  });

  test('index.ts exports ActivityWithRelations type', () => {
    const indexContent = fs.readFileSync(path.join(DIMENSIONS_DIR, 'index.ts'), 'utf-8');
    expect(indexContent).toContain('ActivityWithRelations');
  });
});

// ============================================================================
// TEST L — Migration exists
// ============================================================================

describe('TEST L — Schema migration for dimension metadata', () => {
  test('migration SQL file exists', () => {
    const migrationPath = path.join(
      SRC_ROOT,
      'prisma',
      'migrations',
      '20260906_m12v1_udf_dimension_metadata',
      'migration.sql',
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  test('migration adds all required columns', () => {
    const migrationContent = readFile(
      'prisma/migrations/20260906_m12v1_udf_dimension_metadata/migration.sql',
    );
    expect(migrationContent).toContain('is_filterable');
    expect(migrationContent).toContain('is_sortable');
    expect(migrationContent).toContain('is_groupable');
    expect(migrationContent).toContain('is_bulk_editable');
    expect(migrationContent).toContain('validation_rules');
    expect(migrationContent).toContain('display_order');
    expect(migrationContent).toContain('width');
  });

  test('migration targets ActivityUdfDefinition table', () => {
    const migrationContent = readFile(
      'prisma/migrations/20260906_m12v1_udf_dimension_metadata/migration.sql',
    );
    expect(migrationContent).toContain('ActivityUdfDefinition');
  });
});
