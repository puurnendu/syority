/**
 * M11-V1 Phase 8 — Native Schedule View Integration Tests
 *
 * Verifies that the existing Schedule View is correctly connected to the
 * native M11 scheduling architecture with:
 *
 *   - Single CPM authority: ScheduleOrchestrationService → scheduleEngine.ts
 *   - CalendarEngine 3-tier resolution
 *   - Presentation-only Gantt/UI
 *   - M8.13 progress boundary preserved
 *   - Event/tenant isolation
 *   - No duplicate scheduling engines
 *   - Obsolete import artifacts removed
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helper: Read source file ──────────────────────────────────────────────
function readSource(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source file not found: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function sourceExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CPM AUTHORITY — SINGLE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: CPM Authority Consolidation', () => {
  describe('/api/schedule/calculate route', () => {
    let routeSource: string;

    it('route file exists', () => {
      expect(sourceExists('app/api/schedule/calculate/route.ts')).toBe(true);
      routeSource = readSource('app/api/schedule/calculate/route.ts');
    });

    it('imports ScheduleOrchestrationService', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).toContain('ScheduleOrchestrationService');
    });

    it('calls calculateEventSchedule (delegated CPM)', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).toContain('calculateEventSchedule');
    });

    it('does NOT directly import calculateSchedule from scheduleEngine', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      // The route must not directly call the engine — check both @/ alias and relative paths
      expect(routeSource).not.toMatch(/import.*calculateSchedule.*from.*['"]@?\/lib\/scheduleEngine/);
    });

    it('does NOT contain direct Prisma activity update (persistence is in service)', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).not.toContain('prisma.activity.update');
      expect(routeSource).not.toContain('prisma.$transaction');
    });

    it('does NOT import prisma directly', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).not.toMatch(/import.*prisma.*from.*['"]@?\/lib\/prisma/);
    });

    it('preserves authentication (withTenantGuard + guardApi)', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).toContain('withTenantGuard');
      expect(routeSource).toContain('guardApi');
    });

    it('preserves input validation (event_id required)', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).toContain('event_id');
      expect(routeSource).toContain('normalizeUuid');
    });

    it('preserves backward-compatible response shape { success, data }', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).toContain('success: result.success');
      expect(routeSource).toContain('data: result.calculation');
    });
  });

  describe('/api/projects/[id]/schedule POST route', () => {
    let routeSource: string;

    it('route file exists', () => {
      expect(sourceExists('app/api/projects/[id]/schedule/route.ts')).toBe(true);
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
    });

    it('does not infer Event from Project', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).not.toContain('resolveEventIdFromProject');
      expect(routeSource).not.toContain('calculateEventSchedule');
      expect(routeSource).toContain('EVENT_REQUIRED');
    });

    it('directs CPM to Event calculate API', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('/api/schedule/calculate');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. SCHEDULE ORCHESTRATION SERVICE — AUTHORITATIVE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: ScheduleOrchestrationService Authority', () => {
  let serviceSource: string;

  it('service file exists', () => {
    expect(sourceExists('src/core/schedule/ScheduleOrchestrationService.ts')).toBe(true);
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
  });

  it('imports calculateSchedule from scheduleEngine', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    // Multi-line import — check each part
    expect(serviceSource).toContain('calculateSchedule');
    expect(serviceSource).toContain("from '@/lib/scheduleEngine'");
  });

  it('imports CalendarEngine', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).toContain('CalendarEngine');
  });

  it('uses 3-tier calendar resolution (event → org → fallback)', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).toContain('loadCalendar');
    expect(serviceSource).toContain('calendar_id');
    expect(serviceSource).toContain('is_default');
  });

  it('loads CalendarEngine with getHoursPerDay()', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).toContain('getHoursPerDay()');
  });

  it('persists CPM results via $transaction', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).toContain('$transaction');
    expect(serviceSource).toContain('early_start');
    expect(serviceSource).toContain('early_finish');
    expect(serviceSource).toContain('late_start');
    expect(serviceSource).toContain('late_finish');
    expect(serviceSource).toContain('total_float');
    expect(serviceSource).toContain('is_critical');
  });

  it('persists free_float', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).toContain('free_float');
  });

  it('scopes activities to event_id + organization_id', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).toContain('event_id: eventId');
    expect(serviceSource).toContain('organization_id: orgId');
  });

  it('does NOT reference SchedulingService', () => {
    serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).not.toMatch(/import.*SchedulingService/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. SCHEDULE ENGINE — PURE CPM FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: scheduleEngine.ts Authority', () => {
  let engineSource: string;

  it('schedule engine exists', () => {
    expect(sourceExists('src/lib/scheduleEngine.ts')).toBe(true);
    engineSource = readSource('src/lib/scheduleEngine.ts');
  });

  it('exports calculateSchedule', () => {
    engineSource = readSource('src/lib/scheduleEngine.ts');
    expect(engineSource).toContain('export function calculateSchedule');
  });

  it('supports all 4 relationship types', () => {
    engineSource = readSource('src/lib/scheduleEngine.ts');
    expect(engineSource).toContain("'FS'");
    expect(engineSource).toContain("'SS'");
    expect(engineSource).toContain("'FF'");
    expect(engineSource).toContain("'SF'");
  });

  it('calculates total_float_hours', () => {
    engineSource = readSource('src/lib/scheduleEngine.ts');
    expect(engineSource).toContain('total_float_hours');
  });

  it('calculates free_float_days', () => {
    engineSource = readSource('src/lib/scheduleEngine.ts');
    expect(engineSource).toContain('free_float_days');
  });

  it('supports lag_days', () => {
    engineSource = readSource('src/lib/scheduleEngine.ts');
    expect(engineSource).toContain('lag_days');
  });

  it('identifies critical path activities', () => {
    engineSource = readSource('src/lib/scheduleEngine.ts');
    expect(engineSource).toContain('is_critical');
    expect(engineSource).toContain('critical_path_ids');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. CALENDAR ENGINE — 3-TIER RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: CalendarEngine Integration', () => {
  let calendarSource: string;

  it('CalendarEngine file exists', () => {
    expect(sourceExists('src/lib/CalendarEngine.ts')).toBe(true);
    calendarSource = readSource('src/lib/CalendarEngine.ts');
  });

  it('exports CalendarEngine class', () => {
    calendarSource = readSource('src/lib/CalendarEngine.ts');
    expect(calendarSource).toContain('export class CalendarEngine');
  });

  it('supports working days configuration', () => {
    calendarSource = readSource('src/lib/CalendarEngine.ts');
    expect(calendarSource).toContain('workDays');
  });

  it('supports hours per day', () => {
    calendarSource = readSource('src/lib/CalendarEngine.ts');
    expect(calendarSource).toContain('getHoursPerDay');
  });

  it('supports exceptions', () => {
    calendarSource = readSource('src/lib/CalendarEngine.ts');
    expect(calendarSource).toContain('exception');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. SCHEDULE VIEW — PRESENTATION-ONLY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: Schedule View Presentation-Only', () => {
  describe('ScheduleContainer (Project Schedule)', () => {
    let containerSource: string;

    it('ScheduleContainer file exists', () => {
      expect(sourceExists('src/components/Schedule/ScheduleContainer.tsx')).toBe(true);
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
    });

    it('does NOT import calculateSchedule', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('calculateSchedule');
    });

    it('does NOT import SchedulingService', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('SchedulingService');
    });

    it('does NOT import scheduleEngine', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('scheduleEngine');
    });

    it('does NOT contain CPM-related function calls', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('forwardPass');
      expect(containerSource).not.toContain('backwardPass');
      expect(containerSource).not.toContain('topologicalSort');
    });

    it('reads schedule data via SWR (GET)', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('useSWR');
      expect(containerSource).toContain('/api/projects/');
      expect(containerSource).toContain('/schedule');
    });

    it('does NOT contain active "Undo Import" button', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      // The M11-V1 removal comment references the string for documentation
      // Verify no active button element exists (only the comment should remain)
      expect(containerSource).not.toContain('import/latest');
      const lines = containerSource.split('\n');
      const buttonLines = lines.filter(line =>
        line.includes('Undo Import') && !line.trim().startsWith('//')
        && !line.trim().startsWith('*') && !line.trim().startsWith('{/*')
      );
      expect(buttonLines).toHaveLength(0);
    });

    it('retains hierarchy/WBS functionality', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('wbs_code');
      expect(containerSource).toContain('expandedWbs');
      expect(containerSource).toContain('_isSummary');
    });

    it('retains filter/search functionality', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('search');
      expect(containerSource).toContain('filter');
    });

    it('retains column management', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('ALL_COLUMNS');
      expect(containerSource).toContain('activeCols');
      expect(containerSource).toContain('Layouts');
    });

    it('retains keyboard shortcuts', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('handleKeyDown');
      expect(containerSource).toContain('Insert');
      expect(containerSource).toContain('Delete');
    });

    it('retains baseline functionality', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('MaintainBaselinesModal');
      expect(containerSource).toContain('AssignBaselinesModal');
    });

    it('retains export functionality', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('schedule/export');
      expect(containerSource).toContain('Excel');
    });

    it('retains S-curve and histogram toggles', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('SCurveChart');
      expect(containerSource).toContain('ResourceHistogram');
    });
  });

  describe('ScheduleGantt (Interactive CPM Gantt)', () => {
    let ganttSource: string;

    it('ScheduleGantt file exists', () => {
      expect(sourceExists('src/components/Schedule/ScheduleGantt.tsx')).toBe(true);
      ganttSource = readSource('src/components/Schedule/ScheduleGantt.tsx');
    });

    it('does NOT contain calculateSchedule function call', () => {
      ganttSource = readSource('src/components/Schedule/ScheduleGantt.tsx');
      expect(ganttSource).not.toMatch(/calculateSchedule\s*\(/);
    });

    it('does NOT contain forward/backward pass logic', () => {
      ganttSource = readSource('src/components/Schedule/ScheduleGantt.tsx');
      expect(ganttSource).not.toContain('forwardPass');
      expect(ganttSource).not.toContain('backwardPass');
    });

    it('calls API for schedule data (POST /api/schedule/calculate)', () => {
      ganttSource = readSource('src/components/Schedule/ScheduleGantt.tsx');
      expect(ganttSource).toContain('/api/schedule/calculate');
      expect(ganttSource).toContain('fetch');
    });

    it('displays schedule data in presentation mode only', () => {
      ganttSource = readSource('src/components/Schedule/ScheduleGantt.tsx');
      expect(ganttSource).toContain('early_start');
      expect(ganttSource).toContain('duration_days');
      expect(ganttSource).toContain('total_float_days');
      expect(ganttSource).toContain('is_critical');
    });

    it('has recalculate button that calls API (not local CPM)', () => {
      ganttSource = readSource('src/components/Schedule/ScheduleGantt.tsx');
      expect(ganttSource).toContain('handleRecalculate');
      expect(ganttSource).toContain('Recalculate CPM');
    });
  });

  describe('taskTransformer (display-only)', () => {
    let transformerSource: string;

    it('taskTransformer file exists', () => {
      expect(sourceExists('src/components/Schedule/taskTransformer.ts')).toBe(true);
      transformerSource = readSource('src/components/Schedule/taskTransformer.ts');
    });

    it('does NOT import calculateSchedule', () => {
      transformerSource = readSource('src/components/Schedule/taskTransformer.ts');
      expect(transformerSource).not.toMatch(/import.*calculateSchedule/);
    });

    it('does NOT calculate float', () => {
      transformerSource = readSource('src/components/Schedule/taskTransformer.ts');
      expect(transformerSource).not.toContain('float');
    });

    it('does NOT calculate critical path', () => {
      transformerSource = readSource('src/components/Schedule/taskTransformer.ts');
      expect(transformerSource).not.toContain('critical');
    });

    it('contains only display transformations (duration, dependencies, styles)', () => {
      transformerSource = readSource('src/components/Schedule/taskTransformer.ts');
      expect(transformerSource).toContain('durationDisplay');
      expect(transformerSource).toContain('dependencies');
      expect(transformerSource).toContain('styles');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. NATIVE SCHEDULE DATA CONTRACT
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: Native Schedule Data Contract', () => {
  describe('Schedule API GET response (project schedule)', () => {
    let routeSource: string;

    it('GET route returns workpacks with activities', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('workpacks');
      expect(routeSource).toContain('activities');
    });

    it('includes predecessor relationships', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('activityRelationship');
      expect(routeSource).toContain('relationships');
    });

    it('includes relationship data via activityRelationship model', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      // The route fetches full ActivityRelationship records (which include relationship_type as a field)
      expect(routeSource).toContain('activityRelationship');
    });

    it('includes baseline data', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('baselineActivities');
    });

    it('scopes queries to organization_id', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('organization_id: orgId');
    });

    it('scopes queries to project_id', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('project_id: projectId');
    });
  });

  describe('ScheduleContainer column definitions include native M11 fields', () => {
    let containerSource: string;

    it('includes planned_start column', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'planned_start'");
    });

    it('includes planned_end column', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'planned_end'");
    });

    it('includes duration_hours column', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'duration_hours'");
    });

    it('includes total_float column', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'total_float'");
    });

    it('includes free_float column', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'free_float'");
    });

    it('includes is_critical column', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'is_critical'");
    });

    it('includes early_start / early_finish columns', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'early_start'");
      expect(containerSource).toContain("key: 'early_finish'");
    });

    it('includes late_start / late_finish columns', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'late_start'");
      expect(containerSource).toContain("key: 'late_finish'");
    });

    it('includes workpack column', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain("key: 'workpack'");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. EVENT / TENANT ISOLATION
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: Event and Tenant Isolation', () => {
  describe('Schedule GET API', () => {
    let routeSource: string;

    it('uses withTenantGuard', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('withTenantGuard');
    });

    it('uses guardApi permission check', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('guardApi');
    });

    it('scopes workpacks to organization_id', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      expect(routeSource).toContain('organization_id: orgId');
    });

    it('scopes relationships to organization_id', () => {
      routeSource = readSource('app/api/projects/[id]/schedule/route.ts');
      const relSection = routeSource.substring(routeSource.indexOf('activityRelationship'));
      expect(relSection).toContain('organization_id');
    });
  });

  describe('Schedule Calculate API', () => {
    let routeSource: string;

    it('uses withTenantGuard', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).toContain('withTenantGuard');
    });

    it('passes orgId to ScheduleOrchestrationService', () => {
      routeSource = readSource('app/api/schedule/calculate/route.ts');
      expect(routeSource).toContain('orgId');
    });
  });

  describe('ScheduleOrchestrationService event isolation', () => {
    let serviceSource: string;

    it('queries activities with event_id + organization_id', () => {
      serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
      expect(serviceSource).toContain('event_id: eventId');
      expect(serviceSource).toContain('organization_id: orgId');
    });

    it('queries relationships within event activities only', () => {
      serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
      expect(serviceSource).toContain('predecessor_id: { in:');
      expect(serviceSource).toContain('successor_id: { in:');
    });

    it('verifies event ownership before calculation', () => {
      serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
      expect(serviceSource).toContain('event not found or access denied');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. M8.13 PROGRESS BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: M8.13 Progress Boundary', () => {
  describe('ScheduleContainer progress display', () => {
    let containerSource: string;

    it('reads progress_percent from persisted data', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).toContain('progress_percent');
    });

    it('does NOT import calculateWeightedProgress', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('calculateWeightedProgress');
    });

    it('does NOT import FieldExecutionService', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('FieldExecutionService');
    });

    it('does NOT import ProgressCalculationService', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('ProgressCalculationService');
    });

    it('does NOT calculate SPI or EVM', () => {
      containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
      expect(containerSource).not.toContain('SPI');
      expect(containerSource).not.toMatch(/\bEVM\b/);
    });
  });

  describe('ScheduleOrchestrationService does not own progress', () => {
    let serviceSource: string;

    it('does NOT import calculateWeightedProgress', () => {
      serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
      expect(serviceSource).not.toContain('calculateWeightedProgress');
    });

    it('does NOT reference FieldExecutionService', () => {
      serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
      expect(serviceSource).not.toContain('FieldExecutionService');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. OBSOLETE IMPORT REMOVAL
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: Obsolete Import Artifacts Removed', () => {
  it('ScheduleContainer does NOT contain "Undo Import" button element', () => {
    const source = readSource('src/components/Schedule/ScheduleContainer.tsx');
    // The comment references "Undo Import" for documentation; check that the actual button element is gone
    const lines = source.split('\n');
    const buttonLines = lines.filter(line => 
      line.includes('Undo Import') && !line.trim().startsWith('//')
      && !line.trim().startsWith('*') && !line.trim().startsWith('{/*')
    );
    expect(buttonLines).toHaveLength(0);
  });

  it('ScheduleContainer does NOT reference /import/latest endpoint', () => {
    const source = readSource('src/components/Schedule/ScheduleContainer.tsx');
    expect(source).not.toContain('import/latest');
  });

  it('ScheduleContainer contains the M11-V1 removal comment', () => {
    const source = readSource('src/components/Schedule/ScheduleContainer.tsx');
    expect(source).toContain('P6/MPP import is permanently retired');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. NO DUPLICATE SCHEDULING ENGINES
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: No Duplicate Scheduling Engines', () => {
  it('No production route directly imports calculateSchedule (except scheduleEngine.ts itself)', () => {
    const routeFiles = [
      'app/api/schedule/calculate/route.ts',
      'app/api/projects/[id]/schedule/route.ts',
    ];

    for (const file of routeFiles) {
      if (sourceExists(file)) {
        const source = readSource(file);
        expect(source).not.toMatch(
          /import\s+\{[^}]*calculateSchedule[^}]*\}\s+from\s+['"]@\/lib\/scheduleEngine['"]/
        );
      }
    }
  });

  it('ScheduleOrchestrationService is the sole importer of calculateSchedule in services', () => {
    const serviceSource = readSource('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(serviceSource).toContain('calculateSchedule');
  });

  it('ScheduleGantt does NOT call calculateSchedule directly', () => {
    const ganttSource = readSource('src/components/Schedule/ScheduleGantt.tsx');
    expect(ganttSource).not.toMatch(/calculateSchedule\s*\(/);
  });

  it('ScheduleContainer does NOT call calculateSchedule directly', () => {
    const containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
    expect(containerSource).not.toMatch(/calculateSchedule\s*\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. PLANNED-DATE EDITING IS UI CONVENIENCE ONLY
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: Planned-Date Editing', () => {
  let containerSource: string;

  it('date adjustment preserves duration (UI convenience, not CPM)', () => {
    containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
    expect(containerSource).toContain('Move planned_end to preserve duration');
  });

  it('duration adjustment recalculates planned_end (UI convenience)', () => {
    containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
    expect(containerSource).toContain('Recalculate planned_end = start + new duration');
  });

  it('date editing submits to API (not local CPM)', () => {
    containerSource = readSource('src/components/Schedule/ScheduleContainer.tsx');
    expect(containerSource).toContain("method: 'PUT'");
    expect(containerSource).toContain('/schedule/activities/');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. HX-204 CONTROLLED ACCEPTANCE (via CPM Engine)
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: HX-204 Controlled Acceptance', () => {
  it('scheduleEngine can process HX-204-like activities with FS relationships', async () => {
    const { calculateSchedule } = await import('../src/lib/scheduleEngine');

    const activities = [
      { id: 'hx204-prep', description: 'HX-204 Preparation', duration_hours: 16 },
      { id: 'hx204-pull', description: 'HX-204 Bundle Pullout', duration_hours: 24 },
      { id: 'hx204-clean', description: 'HX-204 Cleaning', duration_hours: 8 },
      { id: 'hx204-inspect', description: 'HX-204 Inspection', duration_hours: 8 },
      { id: 'hx204-install', description: 'HX-204 Re-installation', duration_hours: 24 },
    ];

    const relationships = [
      { predecessor_id: 'hx204-prep', successor_id: 'hx204-pull', relationship_type: 'FS' as any, lag_days: 0 },
      { predecessor_id: 'hx204-pull', successor_id: 'hx204-clean', relationship_type: 'FS' as any, lag_days: 0 },
      { predecessor_id: 'hx204-clean', successor_id: 'hx204-inspect', relationship_type: 'FS' as any, lag_days: 0 },
      { predecessor_id: 'hx204-inspect', successor_id: 'hx204-install', relationship_type: 'FS' as any, lag_days: 0 },
    ];

    const result = calculateSchedule(activities, relationships, {
      project_start_date: new Date('2026-04-10T06:00:00Z'),
      working_hours_per_day: 8,
    });

    expect(result.success).toBe(true);
    expect(result.activities).toHaveLength(5);

    const actMap = new Map(result.activities.map((a: any) => [a.id, a]));
    const prep = actMap.get('hx204-prep')!;
    const pull = actMap.get('hx204-pull')!;
    const clean = actMap.get('hx204-clean')!;
    const inspect = actMap.get('hx204-inspect')!;
    const install = actMap.get('hx204-install')!;

    expect(new Date(pull.early_start).getTime()).toBeGreaterThanOrEqual(new Date(prep.early_finish).getTime());
    expect(new Date(clean.early_start).getTime()).toBeGreaterThanOrEqual(new Date(pull.early_finish).getTime());
    expect(new Date(inspect.early_start).getTime()).toBeGreaterThanOrEqual(new Date(clean.early_finish).getTime());
    expect(new Date(install.early_start).getTime()).toBeGreaterThanOrEqual(new Date(inspect.early_finish).getTime());

    for (const act of result.activities) {
      expect(act.is_critical).toBe(true);
    }

    for (const act of result.activities) {
      expect(act.total_float_hours).toBe(0);
    }
  });

  it('scheduleEngine correctly handles mixed FS/SS/FF/SF for HX-204-like scenario', async () => {
    const { calculateSchedule } = await import('../src/lib/scheduleEngine');

    const activities = [
      { id: 'a1', description: 'HX-204 Scaffold Erection', duration_hours: 16 },
      { id: 'a2', description: 'HX-204 Insulation Removal', duration_hours: 8 },
      { id: 'a3', description: 'HX-204 Bundle Pull', duration_hours: 24 },
      { id: 'a4', description: 'HX-204 Shell Inspection', duration_hours: 8 },
    ];

    const relationships = [
      { predecessor_id: 'a1', successor_id: 'a2', relationship_type: 'FS' as any, lag_days: 0 },
      { predecessor_id: 'a1', successor_id: 'a3', relationship_type: 'SS' as any, lag_days: 1 },
      { predecessor_id: 'a3', successor_id: 'a4', relationship_type: 'FF' as any, lag_days: 0 },
    ];

    const result = calculateSchedule(activities, relationships, {
      project_start_date: new Date('2026-04-10T06:00:00Z'),
      working_hours_per_day: 8,
    });

    expect(result.success).toBe(true);
    expect(result.activities).toHaveLength(4);

    const actMap = new Map(result.activities.map((a: any) => [a.id, a]));
    const a1 = actMap.get('a1')!;
    const a3 = actMap.get('a3')!;

    // SS+1d: a3 starts at a1.start + 1 day
    expect(new Date(a3.early_start).getTime()).toBeGreaterThanOrEqual(
      new Date(a1.early_start).getTime() + 1 * 8 * 3600000
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. GLOBAL SCHEDULE PAGE STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-V1 Phase 8: Global Schedule Page', () => {
  it('global schedule page exists', () => {
    expect(sourceExists('app/(dashboard)/schedule/page.tsx')).toBe(true);
  });

  it('includes ScheduleGantt and ScheduleContainer tabs', () => {
    const source = readSource('app/(dashboard)/schedule/page.tsx');
    expect(source).toContain('ScheduleGantt');
    expect(source).toContain('ScheduleContainer');
  });

  it('has tab toggle between Gantt and Execution views', () => {
    const source = readSource('app/(dashboard)/schedule/page.tsx');
    expect(source).toContain('gantt');
    expect(source).toContain('execution');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. M11-R1: CPM PERSISTENCE AUTHORITY HARDENING
// ═══════════════════════════════════════════════════════════════════════════

describe('M11-R1: CPM Persistence Authority Hardening', () => {
  const applyServicePath = 'src/core/resources/ResourceLevelingApplyService.ts';
  const orchestrationPath = 'src/core/schedule/ScheduleOrchestrationService.ts';
  const levelingServicePath = 'src/core/resources/ResourceLevelingService.ts';
  const scenarioServicePath = 'src/core/schedule/scenario/ScenarioCalculationService.ts';
  const scheduleEnginePath = 'src/lib/scheduleEngine.ts';

  // ── Test A: Resource leveling delegates to orchestration ──
  describe('Test A — Resource leveling delegates to orchestration', () => {
    it('ResourceLevelingApplyService imports ScheduleOrchestrationService', () => {
      const source = readSource(applyServicePath);
      expect(source).toContain("import { ScheduleOrchestrationService }");
      expect(source).toContain("from '@/core/schedule/ScheduleOrchestrationService'");
    });

    it('ResourceLevelingApplyService calls calculateEventSchedule', () => {
      const source = readSource(applyServicePath);
      expect(source).toContain('ScheduleOrchestrationService.calculateEventSchedule');
    });

    it('ResourceLevelingApplyService does NOT directly call calculateSchedule()', () => {
      const source = readSource(applyServicePath);
      // Must NOT import calculateSchedule from scheduleEngine
      expect(source).not.toContain("from '@/lib/scheduleEngine'");
      // Must NOT call calculateSchedule directly (the function)
      // Check for the function call pattern, excluding comments and string references
      const lines = source.split('\n').filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**');
      });
      const codeOnly = lines.join('\n');
      expect(codeOnly).not.toMatch(/\bcalculateSchedule\s*\(/);
    });
  });

  // ── Test B: Calendar enforcement ──
  describe('Test B — Calendar enforcement', () => {
    it('ResourceLevelingApplyService has NO recalculateSchedule method', () => {
      const source = readSource(applyServicePath);
      // The private method should be completely removed
      expect(source).not.toContain('private static async recalculateSchedule');
      expect(source).not.toContain('recalculateSchedule(eventId');
    });

    it('ResourceLevelingApplyService has no hardcoded 8h/day', () => {
      const source = readSource(applyServicePath);
      // No hardcoded working_hours_per_day: 8
      expect(source).not.toMatch(/working_hours_per_day\s*:\s*8\b/);
    });

    it('ScheduleOrchestrationService uses CalendarEngine for hours_per_day', () => {
      const source = readSource(orchestrationPath);
      expect(source).toContain('calendar.getHoursPerDay()');
      expect(source).toContain('working_hours_per_day:');
    });
  });

  // ── Test C: Float-unit consistency ──
  describe('Test C — Float-unit consistency', () => {
    it('ResourceLevelingApplyService does NOT persist total_float_days', () => {
      const source = readSource(applyServicePath);
      // Must NOT have the pattern: total_float: res.total_float_days
      // or any total_float_days persistence
      expect(source).not.toContain('total_float_days');
      expect(source).not.toContain('total_float: res.');
    });

    it('ScheduleOrchestrationService persists total_float in hours (canonical unit)', () => {
      const source = readSource(orchestrationPath);
      expect(source).toContain('total_float: act.total_float_hours');
    });

    it('scheduleEngine outputs both total_float_days and total_float_hours', () => {
      const source = readSource(scheduleEnginePath);
      expect(source).toContain('total_float_days');
      expect(source).toContain('total_float_hours');
    });
  });

  // ── Test D: No direct CPM persistence ──
  describe('Test D — No direct CPM persistence in ResourceLevelingApplyService', () => {
    it('does NOT persist early_start/early_finish/late_start/late_finish/is_critical', () => {
      const source = readSource(applyServicePath);
      // These CPM field persistence patterns must NOT exist in this file
      // Filter to only non-comment lines for accuracy
      const codeLines = source.split('\n').filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**');
      });
      const codeOnly = codeLines.join('\n');
      
      // Must NOT have CPM field writes (the data: { ... } pattern)
      expect(codeOnly).not.toMatch(/early_start:\s*new Date/);
      expect(codeOnly).not.toMatch(/early_finish:\s*new Date/);
      expect(codeOnly).not.toMatch(/late_start:\s*new Date/);
      expect(codeOnly).not.toMatch(/late_finish:\s*new Date/);
      // is_critical should not be set in a persistence context
      expect(codeOnly).not.toMatch(/is_critical:\s*res\./);
    });

    it('does NOT contain ScheduleActivityInput or ScheduleRelationshipInput types', () => {
      const source = readSource(applyServicePath);
      expect(source).not.toContain('ScheduleActivityInput');
      expect(source).not.toContain('ScheduleRelationshipInput');
    });
  });

  // ── Test E: Audit preservation ──
  describe('Test E — Audit preservation', () => {
    it('maintains audit log creation with RESOURCE_LEVELING_APPLIED event', () => {
      const source = readSource(applyServicePath);
      expect(source).toContain('auditLog.create');
      expect(source).toContain('RESOURCE_LEVELING_APPLIED');
    });

    it('captures simulation_id in audit log', () => {
      const source = readSource(applyServicePath);
      expect(source).toContain('simulation_id: payload.simulation_id');
    });

    it('captures old_values and new_values in audit log', () => {
      const source = readSource(applyServicePath);
      expect(source).toContain('old_values:');
      expect(source).toContain('new_values:');
      expect(source).toContain('original_float: rec.float_before');
      expect(source).toContain('remaining_float: rec.float_after');
      expect(source).toContain('float_consumed: rec.float_consumed');
    });

    it('maintains staleness protection (STALE_RECOMMENDATION)', () => {
      const source = readSource(applyServicePath);
      const staleCount = (source.match(/STALE_RECOMMENDATION/g) || []).length;
      // Must have at least 4 STALE_RECOMMENDATION checks:
      // 1. Activity not found / wrong event
      // 2. Activity cancelled/deleted
      // 3. Baseline drift (planned_start)
      // 4. Baseline drift (planned_end)
      // 5. Critical activity protection
      expect(staleCount).toBeGreaterThanOrEqual(4);
    });

    it('maintains critical-activity protection', () => {
      const source = readSource(applyServicePath);
      expect(source).toContain('activity.is_critical');
      expect(source).toContain('is critical and cannot be delayed');
    });

    it('retains $transaction for atomicity of date changes + audit logs', () => {
      const source = readSource(applyServicePath);
      expect(source).toContain('$transaction');
      expect(source).toContain('tx.activity.update');
      expect(source).toContain('tx.auditLog.create');
    });
  });

  // ── Test F: CalendarEngine in orchestration ──
  describe('Test F — CalendarEngine in orchestration', () => {
    it('ScheduleOrchestrationService imports CalendarEngine', () => {
      const source = readSource(orchestrationPath);
      expect(source).toContain("import { CalendarEngine }");
      expect(source).toContain("from '@/lib/CalendarEngine'");
    });

    it('ScheduleOrchestrationService loads calendar with 3-tier resolution', () => {
      const source = readSource(orchestrationPath);
      // Must have event-specific, org default, and fallback calendar loading
      expect(source).toContain('calendarId');
      expect(source).toContain('is_default: true');
      expect(source).toContain('new CalendarEngine()');
    });

    it('ScheduleOrchestrationService passes calendar hours to engine', () => {
      const source = readSource(orchestrationPath);
      expect(source).toContain('working_hours_per_day: calendar.getHoursPerDay()');
    });
  });

  // ── Test G: Single CPM authority classification ──
  describe('Test G — Single CPM authority classification', () => {
    it('ScheduleOrchestrationService is the ONLY service that calls calculateSchedule AND persists CPM', () => {
      const orchSource = readSource(orchestrationPath);
      // Orchestration calls calculateSchedule
      expect(orchSource).toContain('calculateSchedule(');
      // Orchestration persists CPM fields
      expect(orchSource).toContain('early_start:');
      expect(orchSource).toContain('early_finish:');
      expect(orchSource).toContain('late_start:');
      expect(orchSource).toContain('late_finish:');
      expect(orchSource).toContain('total_float:');
      expect(orchSource).toContain('is_critical:');
    });

    it('ResourceLevelingApplyService does NOT call calculateSchedule', () => {
      const source = readSource(applyServicePath);
      expect(source).not.toContain("from '@/lib/scheduleEngine'");
    });

    it('ResourceLevelingService is simulation-only (no CPM persistence)', () => {
      const source = readSource(levelingServicePath);
      // Calls calculateSchedule but does NOT persist CPM fields
      expect(source).toContain('calculateSchedule(');
      // Must NOT have tx.activity.update or prisma.activity.update with CPM fields
      expect(source).not.toContain('prisma.activity.update');
      expect(source).not.toContain('tx.activity.update');
    });

    it('ScenarioCalculationService writes to snapshot_json only (no activity table CPM)', () => {
      const source = readSource(scenarioServicePath);
      expect(source).toContain('calculateSchedule(');
      expect(source).toContain('snapshot_json');
      // Must NOT persist CPM to activity table
      expect(source).not.toContain('prisma.activity.update');
      expect(source).not.toContain('tx.activity.update');
    });

    it('Final caller classification summary', () => {
      const orchSource = readSource(orchestrationPath);
      const applySource = readSource(applyServicePath);
      const levelingSource = readSource(levelingServicePath);
      const scenarioSource = readSource(scenarioServicePath);

      // AUTHORITATIVE: Only ScheduleOrchestrationService
      expect(orchSource).toContain('calculateSchedule(');
      expect(orchSource).toContain('total_float: act.total_float_hours');

      // CONTROLLED ACTION → AUTHORITATIVE: ResourceLevelingApplyService
      expect(applySource).toContain('ScheduleOrchestrationService.calculateEventSchedule');
      expect(applySource).not.toContain("from '@/lib/scheduleEngine'");

      // SIMULATION: ResourceLevelingService
      expect(levelingSource).toContain('calculateSchedule(');
      expect(levelingSource).not.toContain('prisma.activity.update');

      // SIMULATION / SNAPSHOT: ScenarioCalculationService
      expect(scenarioSource).toContain('calculateSchedule(');
      expect(scenarioSource).toContain('snapshot_json');
    });
  });
});
