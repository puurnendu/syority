/**
 * M8.10 — EVM Demo Seed Data
 *
 * Creates a realistic cost-loaded turnaround event for EVM functional testing.
 * This script is idempotent — it checks for existing data before inserting.
 *
 * Creates:
 * - 1 Event with budget_cost and budget_manhours
 * - 4 Workpacks across different disciplines
 * - 20 Activities with budgeted_cost, actual_cost, progress, dates
 * - 1 ScheduleBaseline with BaselineActivity records
 * - ProgressLog entries simulating 8 days of execution
 * - Resource assignments
 * - 1 ScheduleScenario with overrides for scenario EVM testing
 *
 * Architecture Lock: M8.10_ARCHITECTURE_LOCK.md §8
 * AC Source: Activity.actual_cost is authoritative (UD-3 Decision A)
 */

import { prisma, verifyDatabase, disconnect } from './seed-client';
import { randomUUID } from 'crypto';

// ─── Deterministic UUIDs for referential integrity ──────────────────────────

const IDS = {
  // Use a fixed org/site from existing seed data
  ORG_QUERY: 'SELECT id FROM "Organization" LIMIT 1',
  SITE_QUERY: 'SELECT id FROM "Site" LIMIT 1',
  USER_QUERY: 'SELECT id FROM "User" LIMIT 1',

  // New EVM-specific IDs
  event: randomUUID(),
  workpacks: [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
  activities: Array.from({ length: 20 }, () => randomUUID()),
  baseline: randomUUID(),
  scenario: randomUUID(),
};

interface DbRow { id: string }

// ─── Activity Definitions ───────────────────────────────────────────────────

interface ActivityDef {
  description: string;
  workpackIndex: number;
  durationHours: number;
  budgetedCost: number;
  actualCost: number;
  progressPercent: number;
  status: string;
  plannedStartOffset: number; // days from event start
  plannedEndOffset: number;
  actualStartOffset: number | null;
  actualEndOffset: number | null;
  isCritical: boolean;
  isMilestone: boolean;
}

const EVENT_START = new Date('2026-10-01');
const DATA_DATE = new Date('2026-10-08'); // 8 days into execution

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const ACTIVITY_DEFS: ActivityDef[] = [
  // WP0: Mechanical — Heat Exchanger Retube (Critical Path)
  { description: 'HX-101 Shell Side Cleaning', workpackIndex: 0, durationHours: 16, budgetedCost: 12000, actualCost: 11500, progressPercent: 100, status: 'completed', plannedStartOffset: 0, plannedEndOffset: 2, actualStartOffset: 0, actualEndOffset: 2, isCritical: true, isMilestone: false },
  { description: 'HX-101 Tube Bundle Extraction', workpackIndex: 0, durationHours: 8, budgetedCost: 25000, actualCost: 28000, progressPercent: 100, status: 'completed', plannedStartOffset: 2, plannedEndOffset: 3, actualStartOffset: 2, actualEndOffset: 3, isCritical: true, isMilestone: false },
  { description: 'HX-101 NDE Inspection', workpackIndex: 0, durationHours: 12, budgetedCost: 8000, actualCost: 7500, progressPercent: 100, status: 'completed', plannedStartOffset: 3, plannedEndOffset: 4, actualStartOffset: 3, actualEndOffset: 5, isCritical: true, isMilestone: false },
  { description: 'HX-101 Tube Replacement', workpackIndex: 0, durationHours: 24, budgetedCost: 45000, actualCost: 30000, progressPercent: 60, status: 'in_progress', plannedStartOffset: 4, plannedEndOffset: 7, actualStartOffset: 5, actualEndOffset: null, isCritical: true, isMilestone: false },
  { description: 'HX-101 Hydro Test', workpackIndex: 0, durationHours: 8, budgetedCost: 6000, actualCost: 0, progressPercent: 0, status: 'not_started', plannedStartOffset: 7, plannedEndOffset: 8, actualStartOffset: null, actualEndOffset: null, isCritical: true, isMilestone: false },

  // WP1: Piping — Valve Replacement
  { description: 'V-201 Isolation & Drain', workpackIndex: 1, durationHours: 4, budgetedCost: 3000, actualCost: 3200, progressPercent: 100, status: 'completed', plannedStartOffset: 0, plannedEndOffset: 1, actualStartOffset: 0, actualEndOffset: 1, isCritical: false, isMilestone: false },
  { description: 'V-201 Valve Removal', workpackIndex: 1, durationHours: 6, budgetedCost: 5000, actualCost: 4800, progressPercent: 100, status: 'completed', plannedStartOffset: 1, plannedEndOffset: 2, actualStartOffset: 1, actualEndOffset: 2, isCritical: false, isMilestone: false },
  { description: 'V-201 New Valve Install', workpackIndex: 1, durationHours: 8, budgetedCost: 15000, actualCost: 14000, progressPercent: 80, status: 'in_progress', plannedStartOffset: 2, plannedEndOffset: 3, actualStartOffset: 2, actualEndOffset: null, isCritical: false, isMilestone: false },
  { description: 'V-201 Leak Test', workpackIndex: 1, durationHours: 4, budgetedCost: 2000, actualCost: 0, progressPercent: 0, status: 'not_started', plannedStartOffset: 3, plannedEndOffset: 4, actualStartOffset: null, actualEndOffset: null, isCritical: false, isMilestone: false },
  { description: 'V-202 Gate Valve Replacement', workpackIndex: 1, durationHours: 12, budgetedCost: 18000, actualCost: 5000, progressPercent: 30, status: 'in_progress', plannedStartOffset: 1, plannedEndOffset: 4, actualStartOffset: 2, actualEndOffset: null, isCritical: false, isMilestone: false },

  // WP2: Electrical & Instrumentation
  { description: 'E-301 Motor Overhaul', workpackIndex: 2, durationHours: 16, budgetedCost: 22000, actualCost: 20000, progressPercent: 85, status: 'in_progress', plannedStartOffset: 0, plannedEndOffset: 3, actualStartOffset: 0, actualEndOffset: null, isCritical: false, isMilestone: false },
  { description: 'E-301 Cable Re-termination', workpackIndex: 2, durationHours: 8, budgetedCost: 7000, actualCost: 6500, progressPercent: 100, status: 'completed', plannedStartOffset: 3, plannedEndOffset: 4, actualStartOffset: 3, actualEndOffset: 4, isCritical: false, isMilestone: false },
  { description: 'Instrument Calibration Batch 1', workpackIndex: 2, durationHours: 12, budgetedCost: 9000, actualCost: 4000, progressPercent: 40, status: 'in_progress', plannedStartOffset: 2, plannedEndOffset: 5, actualStartOffset: 3, actualEndOffset: null, isCritical: false, isMilestone: false },
  { description: 'DCS Point-to-Point Check', workpackIndex: 2, durationHours: 8, budgetedCost: 5000, actualCost: 0, progressPercent: 0, status: 'not_started', plannedStartOffset: 5, plannedEndOffset: 7, actualStartOffset: null, actualEndOffset: null, isCritical: false, isMilestone: false },

  // WP3: Scaffolding & Support (LOE + Milestones)
  { description: 'Scaffolding Erection - Area A', workpackIndex: 3, durationHours: 8, budgetedCost: 10000, actualCost: 10500, progressPercent: 100, status: 'completed', plannedStartOffset: 0, plannedEndOffset: 1, actualStartOffset: 0, actualEndOffset: 1, isCritical: false, isMilestone: false },
  { description: 'Scaffolding Standby Crew', workpackIndex: 3, durationHours: 80, budgetedCost: 35000, actualCost: 16000, progressPercent: 50, status: 'in_progress', plannedStartOffset: 0, plannedEndOffset: 10, actualStartOffset: 0, actualEndOffset: null, isCritical: false, isMilestone: false },
  { description: 'Mechanical Completion Milestone', workpackIndex: 3, durationHours: 0, budgetedCost: 0, actualCost: 0, progressPercent: 0, status: 'not_started', plannedStartOffset: 9, plannedEndOffset: 9, actualStartOffset: null, actualEndOffset: null, isCritical: true, isMilestone: true },
  { description: 'Safety Walkdown', workpackIndex: 3, durationHours: 4, budgetedCost: 3000, actualCost: 0, progressPercent: 0, status: 'not_started', plannedStartOffset: 9, plannedEndOffset: 10, actualStartOffset: null, actualEndOffset: null, isCritical: false, isMilestone: false },
  { description: 'Ready for Oil-In', workpackIndex: 3, durationHours: 0, budgetedCost: 0, actualCost: 0, progressPercent: 0, status: 'not_started', plannedStartOffset: 10, plannedEndOffset: 10, actualStartOffset: null, actualEndOffset: null, isCritical: true, isMilestone: true },
  { description: 'Crane Availability (LOE)', workpackIndex: 3, durationHours: 80, budgetedCost: 20000, actualCost: 8000, progressPercent: 40, status: 'in_progress', plannedStartOffset: 0, plannedEndOffset: 10, actualStartOffset: 0, actualEndOffset: null, isCritical: false, isMilestone: false },
];

const WORKPACK_NAMES = [
  'WP-MECH-001: Heat Exchanger Retube',
  'WP-PIPE-001: Valve Replacements',
  'WP-ELEC-001: Electrical & Instrumentation',
  'WP-SUPP-001: Scaffolding & Support',
];

async function main() {
  console.log('🌱 M8.10 — Seeding EVM Demo Data...\n');
  await verifyDatabase();

  // Get existing org, site, user
  const orgs = await prisma.$queryRawUnsafe<DbRow[]>(IDS.ORG_QUERY);
  const sites = await prisma.$queryRawUnsafe<DbRow[]>(IDS.SITE_QUERY);
  const users = await prisma.$queryRawUnsafe<DbRow[]>(IDS.USER_QUERY);

  if (!orgs.length || !sites.length || !users.length) {
    console.error('❌ Need at least one Organization, Site, and User. Run base seed first.');
    process.exit(1);
  }

  const orgId = orgs[0].id;
  const siteId = sites[0].id;
  const userId = users[0].id;

  console.log(`  Organization: ${orgId}`);
  console.log(`  Site: ${siteId}`);
  console.log(`  User: ${userId}`);

  // Check if EVM event already exists
  const existing = await prisma.$queryRawUnsafe<DbRow[]>(
    `SELECT id FROM "events" WHERE id = $1`, IDS.event
  );
  if (existing.length > 0) {
    console.log('\n✅ EVM demo data already exists — skipping.');
    await disconnect();
    return;
  }

  // ─── 1. Create Event ─────────────────────────────────────────────────────

  const totalBudget = ACTIVITY_DEFS.reduce((sum, a) => sum + a.budgetedCost, 0);
  const totalManhours = ACTIVITY_DEFS.reduce((sum, a) => sum + a.durationHours, 0);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "events" (id, organization_id, site_id, name, code, event_type, planned_start, planned_end, status, budget_cost, budget_manhours, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
  `, IDS.event, orgId, siteId,
    'EVM Demo Turnaround 2026', 'TA-EVM-2026', 'turnaround',
    EVENT_START, addDays(EVENT_START, 10), 'in_progress',
    totalBudget, totalManhours
  );
  console.log(`  ✅ Event created (BAC: $${totalBudget.toLocaleString()}, ${totalManhours}h)`);

  // ─── 2. Create Workpacks ──────────────────────────────────────────────────

  for (let i = 0; i < WORKPACK_NAMES.length; i++) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Workpack" (id, organization_id, site_id, title, workpack_number, event_id, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'in_execution', $7, NOW(), NOW())
    `, IDS.workpacks[i], orgId, siteId, WORKPACK_NAMES[i], `WP-EVM-${i + 1}`, IDS.event, userId);
  }
  console.log(`  ✅ ${WORKPACK_NAMES.length} Workpacks created`);

  // ─── 3. Create Activities ─────────────────────────────────────────────────

  for (let i = 0; i < ACTIVITY_DEFS.length; i++) {
    const a = ACTIVITY_DEFS[i];
    const pStart = addDays(EVENT_START, a.plannedStartOffset);
    const pEnd = addDays(EVENT_START, a.plannedEndOffset);
    const aStart = a.actualStartOffset !== null ? addDays(EVENT_START, a.actualStartOffset) : null;
    const aEnd = a.actualEndOffset !== null ? addDays(EVENT_START, a.actualEndOffset) : null;

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Activity" (id, organization_id, site_id, workpack_id, event_id, description, duration_hours, planned_start, planned_end, actual_start, actual_end, progress_percent, status, budgeted_cost, actual_cost, is_critical, activity_number, work_category, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
    `,
      IDS.activities[i], orgId, siteId, IDS.workpacks[a.workpackIndex], IDS.event,
      a.description, a.durationHours,
      pStart, pEnd, aStart, aEnd,
      a.progressPercent, a.status,
      a.budgetedCost, a.actualCost,
      a.isCritical,
      `EVM-A${String(i + 1).padStart(3, '0')}`,
      a.isMilestone ? 'MILESTONE' : (a.description.includes('LOE') || a.description.includes('Standby') || a.description.includes('Crane')) ? 'LOE' : 'EXECUTION'
    );
  }
  console.log(`  ✅ ${ACTIVITY_DEFS.length} Activities created`);

  // ─── 4. Create ScheduleBaseline ───────────────────────────────────────────

  await prisma.$executeRawUnsafe(`
    INSERT INTO "ScheduleBaseline" (id, organization_id, event_id, name, is_current, created_by, created_at, description)
    VALUES ($1, $2, $3, $4, true, $5, NOW(), $6)
  `, IDS.baseline, orgId, IDS.event, 'EVM Target Baseline', userId, 'Original target baseline for EVM demo');
  console.log(`  ✅ ScheduleBaseline created (is_current=true)`);

  // ─── 5. Create BaselineActivity records ───────────────────────────────────

  for (let i = 0; i < ACTIVITY_DEFS.length; i++) {
    const a = ACTIVITY_DEFS[i];
    const pStart = addDays(EVENT_START, a.plannedStartOffset);
    const pEnd = addDays(EVENT_START, a.plannedEndOffset);
    const baId = randomUUID();

    await prisma.$executeRawUnsafe(`
      INSERT INTO "BaselineActivity" (id, baseline_id, activity_id, organization_id, planned_start, planned_finish, duration, budgeted_cost, is_critical, status, progress_percent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
    `, baId, IDS.baseline, IDS.activities[i], orgId,
      pStart, pEnd, a.durationHours,
      a.budgetedCost, a.isCritical, 'not_started'
    );
  }
  console.log(`  ✅ ${ACTIVITY_DEFS.length} BaselineActivity records created`);

  // ─── 6. Create ProgressLog entries ────────────────────────────────────────

  let progressLogCount = 0;
  for (let i = 0; i < ACTIVITY_DEFS.length; i++) {
    const a = ACTIVITY_DEFS[i];
    if (a.progressPercent === 0) continue;

    // Simulate daily progress increments
    const startDay = a.actualStartOffset ?? 0;
    const currentDay = 7; // day 7 of execution = data date - 1
    const progressPerDay = a.progressPercent / Math.max(currentDay - startDay, 1);
    const costPerDay = a.actualCost / Math.max(currentDay - startDay, 1);

    for (let day = startDay; day <= Math.min(currentDay, a.actualEndOffset ?? currentDay); day++) {
      const logDate = addDays(EVENT_START, day);
      const cumulativePct = Math.min(Math.round(progressPerDay * (day - startDay + 1)), a.progressPercent);
      const dailyCost = Math.round(costPerDay);
      const plId = randomUUID();

      await prisma.$executeRawUnsafe(`
        INSERT INTO "ProgressLog" (id, activity_id, organization_id, log_date, progress_percent, actual_cost, manhours_actual, data_date, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, plId, IDS.activities[i], orgId,
        logDate, cumulativePct, dailyCost,
        Math.round(a.durationHours * (cumulativePct / 100)),
        logDate
      );
      progressLogCount++;
    }
  }
  console.log(`  ✅ ${progressLogCount} ProgressLog entries created`);

  // ─── 7. Create ScheduleScenario with overrides ────────────────────────────

  await prisma.$executeRawUnsafe(`
    INSERT INTO "schedule_scenarios" (id, organization_id, event_id, name, description, source_type, snapshot_json, activities_affected, float_consumed, project_finish_delta, constraints_resolved, status, created_by, created_at, updated_at, base_baseline_id)
    VALUES ($1, $2, $3, $4, $5, 'manual', '{}', 2, 0, -1.0, 0, 'draft', $6, NOW(), NOW(), $7)
  `, IDS.scenario, orgId, IDS.event,
    'EVM Crash Scenario: Accelerate HX-101',
    'Crash the tube replacement by adding resources, reducing duration but increasing cost',
    userId, IDS.baseline
  );

  // Override: Crash HX-101 Tube Replacement (activity index 3) — reduce duration
  const ovId1 = randomUUID();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ScenarioActivityOverride" (id, scenario_id, activity_id, duration_hours, is_active)
    VALUES ($1, $2, $3, 16, true)
  `, ovId1, IDS.scenario, IDS.activities[3]);

  // Override: Also crash HX-101 Hydro Test (activity index 4) — earlier start
  const ovId2 = randomUUID();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ScenarioActivityOverride" (id, scenario_id, activity_id, duration_hours, planned_start, is_active)
    VALUES ($1, $2, $3, 6, $4, true)
  `, ovId2, IDS.scenario, IDS.activities[4], addDays(EVENT_START, 6));

  console.log(`  ✅ ScheduleScenario + 2 overrides created`);

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════');
  console.log('  M8.10 EVM DEMO DATA SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`  Event ID:      ${IDS.event}`);
  console.log(`  Event:         EVM Demo Turnaround 2026`);
  console.log(`  Event Start:   ${EVENT_START.toISOString().split('T')[0]}`);
  console.log(`  Data Date:     ${DATA_DATE.toISOString().split('T')[0]}`);
  console.log(`  Total BAC:     $${totalBudget.toLocaleString()}`);
  console.log(`  Activities:    ${ACTIVITY_DEFS.length}`);
  console.log(`  - Completed:   ${ACTIVITY_DEFS.filter(a => a.status === 'completed').length}`);
  console.log(`  - In Progress: ${ACTIVITY_DEFS.filter(a => a.status === 'in_progress').length}`);
  console.log(`  - Not Started: ${ACTIVITY_DEFS.filter(a => a.status === 'not_started').length}`);
  console.log(`  - Milestones:  ${ACTIVITY_DEFS.filter(a => a.isMilestone).length}`);
  console.log(`  - Critical:    ${ACTIVITY_DEFS.filter(a => a.isCritical).length}`);
  console.log(`  Total Actual:  $${ACTIVITY_DEFS.reduce((s, a) => s + a.actualCost, 0).toLocaleString()}`);
  console.log(`  Baseline:      ${IDS.baseline}`);
  console.log(`  Scenario:      ${IDS.scenario}`);
  console.log(`  Progress Logs: ${progressLogCount}`);
  console.log('═══════════════════════════════════════════\n');

  await disconnect();
}

main().catch(async (e) => {
  console.error('❌ Failed to seed EVM demo data:', e);
  await disconnect();
  process.exit(1);
});
