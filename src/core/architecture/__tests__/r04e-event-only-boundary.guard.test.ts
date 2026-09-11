/**
 * R0.4-E architectural guard.
 *
 * Prevents the deprecated STO Project campaign container from returning
 * as Event authority, CPM enqueue, S-curve, or M16 navigation.
 *
 * Exceptions (allow-listed, not STO campaign authority):
 * - DigitalPlantProject (/digital-plant)
 * - P6 / MS Project interchange (imported-schedule, xer export)
 * - work_type = Project (business classification)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { resolveNavigation } from '@/core/m16/navigation/NavigationRegistry';

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

/**
 * Production source under STO operational authority.
 *
 * Deliberately excludes tests, docs, and scripts: the guard protects runtime
 * authority, not prose or one-off census tooling.
 */
const SCANNED_ROOTS = ['src', 'app'];

/**
 * Allow-listed non-STO Project concepts. These are legitimate and MUST keep
 * working — the guard must never degrade into "no word Project".
 *
 * - DigitalPlantProject  → engineering / extraction workspace
 * - P6 / MS Project      → external interchange (xer / xml / imported schedule)
 * - work_type = Project  → ordinary business classification
 */
const ALLOWED_PATH_FRAGMENTS = [
  'digital-plant',
  'imported-schedule',
  'Scheduling/parsers',
  'ProjectBranchingService',
  '__tests__',
  '.test.',
];

function walk(rel: string): string[] {
  const abs = path.join(root, rel);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const childRel = path.join(rel, entry);
    if (statSync(path.join(root, childRel)).isDirectory()) {
      out.push(...walk(childRel));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(childRel);
    }
  }
  return out;
}

function productionFiles(): string[] {
  return SCANNED_ROOTS.flatMap(walk)
    // Normalize separators so the allow-list is platform-independent.
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => !ALLOWED_PATH_FRAGMENTS.some((frag) => f.includes(frag)));
}

/**
 * Strip comments before scanning.
 *
 * OD9.2: several files now *document* the forbidden patterns in a header comment,
 * explaining what was removed and why. Matching raw source flagged those explanations as
 * violations. The assertions below are unchanged — only comment text is excluded, so a
 * real reintroduction in executable code still fails.
 */
function codeOf(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Files whose executable source matches `pattern`, as "path" strings for readable failures. */
function filesMatching(pattern: RegExp): string[] {
  return productionFiles().filter((f) => pattern.test(codeOf(f)));
}

describe('R0.4-E Event-only operational boundary guard', () => {
  it('CPM enqueue authority is Event, not Project', () => {
    const enqueue = read('src/core/schedule/enqueueEventScheduleRecalculate.ts');
    expect(enqueue).toContain('eventId');
    expect(enqueue).toContain('jobId: `recalc-${eventId}`');
    expect(enqueue).not.toContain('project_id');
    expect(enqueue).not.toContain('resolveEventIdFromProject');

    const activityService = read('src/modules/Activity/Services/ActivityService.ts');
    expect(activityService).toContain('enqueueEventScheduleRecalculate');
    expect(activityService).not.toContain('projectId: workpack.project_id');
    expect(activityService).not.toContain('recalc-${workpack.project_id}');
  });

  it('CPM worker requires Event and does not resolve from Project', () => {
    const worker = read('src/workers/scheduleRecalculateWorker.ts');
    expect(worker).toContain('calculateEventSchedule');
    expect(worker).not.toContain('resolveEventIdFromProject');
    expect(worker).toContain('Missing eventId or orgId');
  });

  it('M11 orchestration has no Project→Event resolver', () => {
    const orch = read('src/core/schedule/ScheduleOrchestrationService.ts');
    expect(orch).not.toContain('resolveEventIdFromProject');
    expect(orch).toContain('calculateEventSchedule');
  });

  it('Project schedule POST is retired as CPM authority', () => {
    const route = read('app/api/projects/[id]/schedule/route.ts');
    expect(route).toContain('EVENT_REQUIRED');
    expect(route).not.toContain('resolveEventIdFromProject');
    expect(route).not.toContain('calculateEventSchedule');
  });

  it('Control Tower S-curve uses Event EVM API, not Project API', () => {
    const chart = read('src/components/Schedule/SCurveChart.tsx');
    const tower = read('src/components/m13/ControlTowerDashboard.tsx');
    const evm = read('src/core/evm/EvmSnapshotService.ts');
    expect(chart).toContain('/api/events/${eventId}/schedule/evm/s-curve');
    expect(chart).not.toContain('/api/projects/');
    expect(tower).toContain('eventId={eventId}');
    expect(tower).not.toContain('projectId={eventId}');
    expect(evm).toContain('WHERE event_id = $1 AND organization_id = $2');
    expect(evm).not.toMatch(/FROM\s+"Project"/);
    expect(evm).not.toMatch(/prisma\.project/);
  });

  it('M16 STO campaign navigation is Event-route based', () => {
    const nav = read('src/core/m16/navigation/NavigationRegistry.ts');
    expect(nav).toContain('/events/${eventId}/control-tower');
    expect(nav).toContain('/events/${eventId}/ta-dashboard');
    expect(nav).not.toContain('/projects/${projectId}');

    const route = resolveNavigation('control_tower', { eventId: 'evt-1', projectId: 'proj-1' });
    expect(route?.path).toBe('/events/evt-1/control-tower');
    expect(route?.path).not.toMatch(/^\/projects\//);
  });

  it('allow-listed non-STO Project concepts remain outside this guard', () => {
    const digitalPlant = read('app/(dashboard)/digital-plant/page.tsx');
    expect(digitalPlant.length).toBeGreaterThan(0);

    const workpackForm = read('src/components/Workpack/WorkpackCreateForm.tsx');
    expect(workpackForm).toMatch(/work_type:\s*'Shutdown'/);
  });

  it('Project S-curve/EVM engine stays retired — M8.10 is the sole authority', () => {
    const route = read('app/api/projects/[id]/s-curve/route.ts');
    expect(route).toContain('PROJECT_S_CURVE_RETIRED');

    // No second EVM engine: none of the EVM math may reappear here.
    expect(route).not.toMatch(/\bbcws\b/i);
    expect(route).not.toMatch(/\bbcwp\b/i);
    expect(route).not.toMatch(/\backwp\b/i);
    expect(route).not.toMatch(/\bspi\b/i);
    expect(route).not.toMatch(/\bcpi\b/i);
    expect(route).not.toMatch(/\beac\b/i);

    // No Project-scoped campaign query or Project date window.
    expect(route).not.toMatch(/prisma\./);
    expect(route).not.toContain('project_id');
    expect(route).not.toContain('plannedSdDate');

    // The forbidden Phase O campaign error must be gone.
    expect(route).not.toContain('Project is missing planned start/finish dates');
  });

  it('Workpack creation requires Event context and never guesses it', () => {
    const service = read('src/modules/Workpack/Services/WorkpackService.ts');
    expect(service).toContain('WorkpackIdentityError');
    expect(service).toContain('EVENT_REQUIRED');
    expect(service).toContain('CROSS_TENANT_EVENT');
    // Event must be re-checked against the session organization.
    expect(service).toMatch(/prisma\.event\.findFirst/);
    // Creation must not fall back to a Project-derived Event.
    expect(service).not.toContain('resolveEventIdFromProject');
  });

  it('no Project→Event resolver is reintroduced anywhere in production source', () => {
    expect(filesMatching(/resolveEventIdFromProject/)).toEqual([]);
    // A Project id may never be used to look up / authorize an Event.
    expect(filesMatching(/event\.find\w+\(\s*\{[^}]*project_id/)).toEqual([]);
  });

  it('a Project id is never passed to an Event API route', () => {
    // Guards the R0.4-E "same ID can be event" conflation regression.
    expect(filesMatching(/\/api\/events\/\$\{\s*projectId\s*\}/)).toEqual([]);
    expect(filesMatching(/\/events\/\$\{\s*projectId\s*\}/)).toEqual([]);
  });

  it('M16 campaign navigation never emits a Project URL for any target', () => {
    const nav = read('src/core/m16/navigation/NavigationRegistry.ts');
    expect(nav).not.toMatch(/path:\s*`\/projects\//);

    // Every resolvable target, given both ids, must avoid /projects/.
    const targets = [
      'control_tower', 'dashboard', 'execution', 'schedule', 'reports',
      'constraints', 'workpacks', 'delayed_workpacks', 'critical_activities',
      'equipment', 'workpack', 'activity',
    ];
    for (const target of targets) {
      const route = resolveNavigation(target, {
        eventId: 'evt-1',
        projectId: 'proj-1',
        assetId: 'asset-1',
        workpackId: 'wp-1',
        activityId: 'act-1',
      });
      expect(route?.path ?? '').not.toMatch(/^\/projects\//);
    }
  });

  it('CPM enqueue is reachable only through the Event adapter', () => {
    // Nothing outside the adapter may queue a raw CPM recalculate job.
    const offenders = filesMatching(/scheduleRecalculateQueue\.add/).filter(
      (f) => !f.includes('enqueueEventScheduleRecalculate')
    );
    expect(offenders).toEqual([]);
  });
});
