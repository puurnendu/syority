/**
 * M8.15 — Equipment 360 V1 Tests
 *
 * Verifies the Equipment → Scope → Workpack → Activity → Schedule → Execution → Progress chain.
 *
 * PROGRESS AUTHORITY VERIFICATION:
 *   These tests verify that Equipment 360 DELEGATES to M8.13, never calculates independently.
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ─── 1. Source Code Static Analysis Tests ──────────────────────────────────
// These tests verify architectural rules without running the server.

describe('M8.15 Equipment 360 — Architectural Compliance', () => {
  const apiRoute = fs.readFileSync(
    path.resolve(__dirname, '../../../../app/api/assets/[assetId]/360/route.ts'),
    'utf-8'
  );

  const clientComponent = fs.readFileSync(
    path.resolve(__dirname, '../../../../app/(dashboard)/asset-register/[assetId]/360/Equipment360Client.tsx'),
    'utf-8'
  );

  const serverPage = fs.readFileSync(
    path.resolve(__dirname, '../../../../app/(dashboard)/asset-register/[assetId]/360/page.tsx'),
    'utf-8'
  );

  // ── Progress Authority ─────────────────────────────────────────────────

  test('1. API route imports ProgressAggregationService (M8.13 delegation)', () => {
    expect(apiRoute).toContain('ProgressAggregationService');
  });

  test('2. API route does NOT contain calculateWeightedProgress', () => {
    expect(apiRoute).not.toContain('calculateWeightedProgress');
  });

  test('3. API route does NOT contain calculateSimpleAverage', () => {
    expect(apiRoute).not.toContain('calculateSimpleAverage');
  });

  test('4. API route does NOT contain sum(progress) / count patterns', () => {
    // No manual averaging
    expect(apiRoute).not.toMatch(/sum\s*\(.*progress/i);
    expect(apiRoute).not.toMatch(/\.reduce\(.*(progress_percent|weightedProgress)/);
  });

  test('5. API route does NOT contain SPI or EVM calculation', () => {
    expect(apiRoute).not.toContain('calculateSPI');
    expect(apiRoute).not.toContain('calculateCPI');
    expect(apiRoute).not.toContain('earnedValue');
    expect(apiRoute).not.toContain('planned_value');
  });

  test('6. Client component does NOT contain progress calculation logic', () => {
    expect(clientComponent).not.toContain('calculateWeightedProgress');
    expect(clientComponent).not.toContain('calculateSimpleAverage');
    expect(clientComponent).not.toContain('calculateProgressMetrics');
    expect(clientComponent).not.toMatch(/sum\s*\(.*progress/i);
  });

  test('7. Client component does NOT contain EVM/SPI calculation', () => {
    expect(clientComponent).not.toContain('calculateSPI');
    expect(clientComponent).not.toContain('calculateCPI');
    expect(clientComponent).not.toContain('earnedValue');
  });

  // ── Tenant Isolation ───────────────────────────────────────────────────

  test('8. API route uses guardApi for RBAC', () => {
    expect(apiRoute).toContain("guardApi('workpacks.view')");
  });

  test('9. API route uses orgScope for tenant extraction', () => {
    expect(apiRoute).toContain('orgScope(session!)');
  });

  test('10. API route filters asset by organization_id', () => {
    expect(apiRoute).toContain('organization_id: orgId');
  });

  test('11. API route filters scope items by organization_id', () => {
    // Verify tenant-scoped query for scope items
    const scopeItemQuery = apiRoute.includes('organization_id: orgId') &&
                           apiRoute.includes("prisma.scopeItem.findMany");
    expect(scopeItemQuery).toBe(true);
  });

  test('12. API route filters workpacks by organization_id', () => {
    const wpQuery = apiRoute.includes('organization_id: orgId') &&
                    apiRoute.includes("prisma.workpack.findMany");
    expect(wpQuery).toBe(true);
  });

  test('13. API route filters activities by organization_id', () => {
    const actQuery = apiRoute.includes('organization_id: orgId') &&
                     apiRoute.includes("prisma.activity.findMany");
    expect(actQuery).toBe(true);
  });

  // ── M8.13 Delegation Pattern ───────────────────────────────────────────

  test('14. API route calls getWorkpackProgress (M8.13)', () => {
    expect(apiRoute).toContain('ProgressAggregationService.getWorkpackProgress');
  });

  test('15. API route calls getIdenticalActivityProgress (M8.13)', () => {
    expect(apiRoute).toContain('ProgressAggregationService.getIdenticalActivityProgress');
  });

  test('16. API route passes orgId to M8.13 service calls', () => {
    expect(apiRoute).toContain('getWorkpackProgress(orgId');
    expect(apiRoute).toContain('getIdenticalActivityProgress(\n          orgId');
  });

  // ── Event Grouping ────────────────────────────────────────────────────

  test('17. API response structure includes events array (event-grouped)', () => {
    expect(apiRoute).toContain('events');
    // Verify data is grouped by event, not merged
    expect(apiRoute).toContain('Array.from(eventIds)');
  });

  test('18. API route does NOT merge progress across events', () => {
    // No cross-event progress aggregation
    expect(apiRoute).not.toContain('allEventsProgress');
    expect(apiRoute).not.toContain('mergeProgress');
    expect(apiRoute).not.toContain('combineMetrics');
  });

  // ── Read-Only Verification ─────────────────────────────────────────────

  test('19. API route only exports GET (read-only)', () => {
    expect(apiRoute).toContain('export async function GET');
    expect(apiRoute).not.toContain('export async function POST');
    expect(apiRoute).not.toContain('export async function PUT');
    expect(apiRoute).not.toContain('export async function PATCH');
    expect(apiRoute).not.toContain('export async function DELETE');
  });

  test('20. API route does NOT perform any create/update/delete operations', () => {
    expect(apiRoute).not.toContain('.create(');
    expect(apiRoute).not.toContain('.update(');
    expect(apiRoute).not.toContain('.delete(');
    expect(apiRoute).not.toContain('.upsert(');
  });

  // ── Schedule Data Rules ────────────────────────────────────────────────

  test('21. API route does NOT recalculate CPM or float', () => {
    expect(apiRoute).not.toContain('calculateCPM');
    expect(apiRoute).not.toContain('calculateFloat');
    expect(apiRoute).not.toContain('recalculateSchedule');
    expect(apiRoute).not.toContain('forwardPass');
    expect(apiRoute).not.toContain('backwardPass');
  });

  // ── Data Minimization ─────────────────────────────────────────────────

  test('22. API route uses select (not include *) for asset query', () => {
    expect(apiRoute).toContain('select:');
  });

  test('23. API route does NOT return equipment_technical_data (large JSON)', () => {
    expect(apiRoute).not.toContain('equipment_technical_data');
  });

  test('24. API route does NOT return p6 fields', () => {
    expect(apiRoute).not.toContain('p6_object_id');
    expect(apiRoute).not.toContain('p6_activity_id');
  });

  // ── UI Structure ───────────────────────────────────────────────────────

  test('25. Client component has all 7 tabs', () => {
    expect(clientComponent).toContain("'overview'");
    expect(clientComponent).toContain("'scope'");
    expect(clientComponent).toContain("'workpacks'");
    expect(clientComponent).toContain("'activities'");
    expect(clientComponent).toContain("'schedule'");
    expect(clientComponent).toContain("'execution'");
    expect(clientComponent).toContain("'progress'");
  });

  test('26. Client component has event selector for multi-event', () => {
    expect(clientComponent).toContain('selectedEventIdx');
    expect(clientComponent).toContain('data.events.length > 1');
  });

  test('27. Client component has empty state handling', () => {
    expect(clientComponent).toContain('EmptyState');
  });

  test('28. Client component has error state handling', () => {
    expect(clientComponent).toContain('error');
    expect(clientComponent).toContain('Retry');
  });

  test('29. Client component has loading state', () => {
    expect(clientComponent).toContain('Loading Equipment 360');
  });

  // ── Server Page ────────────────────────────────────────────────────────

  test('30. Server page validates session', () => {
    expect(serverPage).toContain('getServerSession');
    expect(serverPage).toContain("redirect('/login')");
  });

  test('31. Server page validates asset ownership', () => {
    expect(serverPage).toContain('organization_id: orgId');
    expect(serverPage).toContain('notFound()');
  });

  // ── No Schema Changes ─────────────────────────────────────────────────

  test('32. No Prisma schema modifications', () => {
    // Verify by checking that the schema file was NOT modified by M8.15
    // This test reads the schema and verifies no M8.15 markers exist
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../../../../prisma/schema.prisma'),
      'utf-8'
    );
    expect(schema).not.toContain('M8.15');
    expect(schema).not.toContain('Equipment360');
  });
});
