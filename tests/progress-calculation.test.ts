/**
 * M8.13 Phase 1 — ProgressCalculationService Unit Tests
 *
 * Comprehensive tests for the PURE calculation engine.
 * These tests verify:
 * 1.  0% progress
 * 2.  100% progress
 * 3.  50% progress
 * 4.  Weighted activities (unequal durations)
 * 5.  Unequal durations
 * 6.  Zero duration
 * 7.  Null duration
 * 8.  Null progress
 * 9.  Cancelled activities (excluded)
 * 10. Inactive activities (status check)
 * 11. All activities complete
 * 12. No valid activities
 * 13. Balance calculation
 * 14. Deterministic repeated execution
 * 15. Rounding
 * 16. Boundary values
 * 17. Identical activity classification foundation
 * 18. Scope-change-created activity remains 0% unless actual progress
 * 19. Reference-vs-new calculation consistency
 */

import { describe, test, expect } from 'vitest';

import {
  calculateProgressMetrics,
  filterIncludedActivities,
  isActivityIncluded,
  calculateDimensionProgress,
  calculateDisciplineProgress,
  calculateWorkpackProgress,
  calculateIdenticalActivityProgress,
  calculateEquipmentTypeProgress,
  calculateStandardActivityTypeProgress,
} from '@/core/progress/ProgressCalculationService';
import type { ProgressActivityInput } from '@/core/progress/types';

// Helper to create test activities
function makeActivity(
  overrides: Partial<ProgressActivityInput> = {}
): ProgressActivityInput {
  return {
    activityId: overrides.activityId ?? 'act-1',
    durationHours: overrides.durationHours ?? 10,
    progressPercent: overrides.progressPercent ?? 0,
    status: overrides.status ?? 'not_started',
    workpackId: overrides.workpackId ?? 'wp-1',
    eventId: overrides.eventId ?? 'evt-1',
    ...overrides,
  };
}

// ─── Reference Implementation ────────────────────────────────────────────────
// Direct copy of FieldExecutionService.calculateWeightedProgress for comparison

function referenceCalculateWeightedProgress(
  activities: { duration_hours?: any; progress_percent?: any }[]
): number {
  if (!activities || activities.length === 0) return 0;
  let totalWeighted = 0;
  let totalDuration = 0;
  let simpleSum = 0;
  for (const act of activities) {
    const dur = Number(act.duration_hours ?? 0);
    const prog = Number(act.progress_percent ?? 0);
    simpleSum += prog;
    if (dur > 0) {
      totalWeighted += prog * dur;
      totalDuration += dur;
    }
  }
  if (totalDuration > 0) {
    return Math.round(totalWeighted / totalDuration);
  }
  return Math.round(simpleSum / activities.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ProgressCalculationService', () => {
  // ─── Test 1: 0% Progress ───────────────────────────────────────────────────
  test('1. should return 0% for activities with zero progress', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 0, durationHours: 10 }),
      makeActivity({ activityId: 'act-2', progressPercent: 0, durationHours: 20 }),
    ]);
    expect(result.weightedProgress).toBe(0);
    expect(result.notStartedActivities).toBe(2);
    expect(result.completedActivities).toBe(0);
    expect(result.inProgressActivities).toBe(0);
  });

  // ─── Test 2: 100% Progress ────────────────────────────────────────────────
  test('2. should return 100% for all complete activities', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 100, durationHours: 10, status: 'completed' }),
      makeActivity({ activityId: 'act-2', progressPercent: 100, durationHours: 20, status: 'completed' }),
    ]);
    expect(result.weightedProgress).toBe(100);
    expect(result.completedActivities).toBe(2);
    expect(result.balanceDurationHours).toBe(0);
  });

  // ─── Test 3: 50% Progress ────────────────────────────────────────────────
  test('3. should return 50% for equal activities at 50%', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 50, durationHours: 10, status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', progressPercent: 50, durationHours: 10, status: 'in_progress' }),
    ]);
    expect(result.weightedProgress).toBe(50);
    expect(result.inProgressActivities).toBe(2);
  });

  // ─── Test 4: Weighted Activities (Unequal Durations) ──────────────────────
  test('4. should weight by duration — larger activity dominates', () => {
    // 10h at 100% + 90h at 0% = 1000 / 100 = 10%
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 100, durationHours: 10, status: 'completed' }),
      makeActivity({ activityId: 'act-2', progressPercent: 0, durationHours: 90 }),
    ]);
    expect(result.weightedProgress).toBe(10);
  });

  // ─── Test 5: Unequal Durations — more complex ────────────────────────────
  test('5. should handle unequal durations correctly', () => {
    // 8h at 50% (=400) + 2h at 100% (=200) = 600/10 = 60%
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 50, durationHours: 8, status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', progressPercent: 100, durationHours: 2, status: 'completed' }),
    ]);
    expect(result.weightedProgress).toBe(60);
    expect(result.totalDurationHours).toBe(10);
    expect(result.completedDurationHours).toBe(6); // 8*0.5 + 2*1.0 = 6
    expect(result.balanceDurationHours).toBe(4);
  });

  // ─── Test 6: Zero Duration Activities ────────────────────────────────────
  test('6. should fall back to simple average when all durations are zero', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 60, durationHours: 0, status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', progressPercent: 40, durationHours: 0, status: 'in_progress' }),
    ]);
    // Simple average: (60+40)/2 = 50
    expect(result.weightedProgress).toBe(50);
    expect(result.totalDurationHours).toBe(0);
  });

  // ─── Test 7: Null Duration ──────────────────────────────────────────────
  test('7. should treat null duration as zero (fallback to simple avg)', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 80, durationHours: null, status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', progressPercent: 20, durationHours: null, status: 'in_progress' }),
    ]);
    // Simple average: (80+20)/2 = 50
    expect(result.weightedProgress).toBe(50);
  });

  // ─── Test 8: Null Progress ──────────────────────────────────────────────
  test('8. should treat null progress as 0%', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: null, durationHours: 10 }),
      makeActivity({ activityId: 'act-2', progressPercent: 100, durationHours: 10, status: 'completed' }),
    ]);
    // (0*10 + 100*10) / 20 = 50
    expect(result.weightedProgress).toBe(50);
  });

  // ─── Test 9: Cancelled Activities (Excluded) ──────────────────────────────
  test('9. should exclude cancelled activities from calculation', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 100, durationHours: 10, status: 'completed' }),
      makeActivity({ activityId: 'act-2', progressPercent: 0, durationHours: 90, status: 'cancelled' }),
    ]);
    // Only act-1 counted: 100%
    expect(result.weightedProgress).toBe(100);
    expect(result.totalActivities).toBe(1);
  });

  // ─── Test 10: On-hold Activities (Still Included) ─────────────────────────
  test('10. should include on_hold activities in calculation', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 50, durationHours: 10, status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', progressPercent: 30, durationHours: 10, status: 'on_hold' }),
    ]);
    // (50*10 + 30*10)/20 = 40
    expect(result.weightedProgress).toBe(40);
    expect(result.totalActivities).toBe(2);
  });

  // ─── Test 11: All Activities Complete ──────────────────────────────────────
  test('11. should return 100% with zero balance when all complete', () => {
    const activities = Array.from({ length: 5 }, (_, i) =>
      makeActivity({
        activityId: `act-${i}`,
        progressPercent: 100,
        durationHours: (i + 1) * 10,
        status: 'completed',
      })
    );
    const result = calculateProgressMetrics(activities);
    expect(result.weightedProgress).toBe(100);
    expect(result.balanceDurationHours).toBe(0);
    expect(result.completedActivities).toBe(5);
    expect(result.totalDurationHours).toBe(150); // 10+20+30+40+50
  });

  // ─── Test 12: No Valid Activities ────────────────────────────────────────
  test('12. should return 0% for empty input', () => {
    const result = calculateProgressMetrics([]);
    expect(result.weightedProgress).toBe(0);
    expect(result.totalActivities).toBe(0);
    expect(result.totalDurationHours).toBe(0);
  });

  test('12b. should return 0% when all activities are cancelled', () => {
    const result = calculateProgressMetrics([
      makeActivity({ status: 'cancelled', progressPercent: 50 }),
      makeActivity({ activityId: 'act-2', status: 'cancelled', progressPercent: 100 }),
    ]);
    expect(result.weightedProgress).toBe(0);
    expect(result.totalActivities).toBe(0);
  });

  // ─── Test 13: Balance Calculation ────────────────────────────────────────
  test('13. should correctly calculate balance (completed + balance = total)', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 30, durationHours: 100, status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', progressPercent: 70, durationHours: 100, status: 'in_progress' }),
    ]);
    // Total: 200h, Completed equivalent: (30/100)*100 + (70/100)*100 = 30+70 = 100h
    // Balance: 200 - 100 = 100h
    expect(result.totalDurationHours).toBe(200);
    expect(result.completedDurationHours).toBe(100);
    expect(result.balanceDurationHours).toBe(100);
    expect(result.completedDurationHours + result.balanceDurationHours).toBe(result.totalDurationHours);
  });

  // ─── Test 14: Deterministic Repeated Execution ──────────────────────────
  test('14. should produce identical results on repeated calls', () => {
    const activities = [
      makeActivity({ progressPercent: 33, durationHours: 17 }),
      makeActivity({ activityId: 'act-2', progressPercent: 67, durationHours: 23 }),
      makeActivity({ activityId: 'act-3', progressPercent: 50, durationHours: 11 }),
    ];
    const r1 = calculateProgressMetrics(activities);
    const r2 = calculateProgressMetrics(activities);
    const r3 = calculateProgressMetrics(activities);

    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  // ─── Test 15: Rounding ──────────────────────────────────────────────────
  test('15. should round progress to nearest integer', () => {
    // 33*10 + 67*10 = 330+670 = 1000 / 20 = 50 (exact)
    const result1 = calculateProgressMetrics([
      makeActivity({ progressPercent: 33, durationHours: 10 }),
      makeActivity({ activityId: 'act-2', progressPercent: 67, durationHours: 10 }),
    ]);
    expect(result1.weightedProgress).toBe(50);

    // 33*7 + 67*13 = 231+871 = 1102/20 = 55.1 → round to 55
    const result2 = calculateProgressMetrics([
      makeActivity({ progressPercent: 33, durationHours: 7 }),
      makeActivity({ activityId: 'act-2', progressPercent: 67, durationHours: 13 }),
    ]);
    expect(result2.weightedProgress).toBe(55);
  });

  // ─── Test 16: Boundary Values ──────────────────────────────────────────
  test('16a. should handle single activity', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 42, durationHours: 100, status: 'in_progress' }),
    ]);
    expect(result.weightedProgress).toBe(42);
    expect(result.totalActivities).toBe(1);
  });

  test('16b. should handle very large number of activities', () => {
    const activities = Array.from({ length: 1000 }, (_, i) =>
      makeActivity({
        activityId: `act-${i}`,
        progressPercent: i % 101, // 0..100
        durationHours: 10,
      })
    );
    const result = calculateProgressMetrics(activities);
    expect(result.totalActivities).toBe(1000);
    expect(result.weightedProgress).toBeGreaterThanOrEqual(0);
    expect(result.weightedProgress).toBeLessThanOrEqual(100);
  });

  test('16c. should clamp progress > 100 to 100', () => {
    // Edge case: progress_percent > 100 (data integrity issue, but handle gracefully)
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 150, durationHours: 10 }),
    ]);
    expect(result.weightedProgress).toBe(100);
  });

  test('16d. should clamp negative progress to 0', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: -10, durationHours: 10 }),
    ]);
    expect(result.weightedProgress).toBe(0);
  });

  // ─── Test 17: Identical Activity Classification Foundation ──────────────
  test('17. should pass through standardActivityTypeId without affecting calculation', () => {
    const activities = [
      makeActivity({ progressPercent: 50, durationHours: 10, standardActivityTypeId: 'sat-1' }),
      makeActivity({ activityId: 'act-2', progressPercent: 50, durationHours: 10, standardActivityTypeId: 'sat-2' }),
    ];
    const result = calculateProgressMetrics(activities);
    expect(result.weightedProgress).toBe(50);
    // standardActivityTypeId doesn't affect progress calc but is preserved in input
    expect(activities[0].standardActivityTypeId).toBe('sat-1');
  });

  // ─── Test 18: Scope-Change Activity at 0% ──────────────────────────────
  test('18. scope-change-created activity should remain at 0% unless actual progress', () => {
    const result = calculateProgressMetrics([
      makeActivity({ progressPercent: 100, durationHours: 100, status: 'completed' }),
      // New scope-change activity — 0% by default
      makeActivity({
        activityId: 'scope-change-act',
        progressPercent: 0,
        durationHours: 50,
        status: 'not_started',
      }),
    ]);
    // (100*100 + 0*50) / 150 = 10000/150 = 66.67 → round to 67
    expect(result.weightedProgress).toBe(67);
    expect(result.totalActivities).toBe(2);
    expect(result.notStartedActivities).toBe(1);
    // Scope-change activity correctly reduces overall progress
    // Original scope: 100%. Total scope: 67%. Impact: -33%
  });

  // ─── Test 19: Reference vs New Calculation Consistency ────────────────────
  describe('19. Reference vs New calculation consistency', () => {
    const testCases = [
      { desc: 'all zero', acts: [{ dur: 0, prog: 0 }, { dur: 0, prog: 0 }] },
      { desc: 'all 100', acts: [{ dur: 10, prog: 100 }, { dur: 20, prog: 100 }] },
      { desc: 'mixed', acts: [{ dur: 10, prog: 30 }, { dur: 20, prog: 60 }, { dur: 5, prog: 100 }] },
      { desc: 'null dur', acts: [{ dur: null, prog: 50 }, { dur: null, prog: 80 }] },
      { desc: 'null prog', acts: [{ dur: 10, prog: null }, { dur: 10, prog: 50 }] },
      { desc: 'single', acts: [{ dur: 15, prog: 73 }] },
      { desc: 'unequal', acts: [{ dur: 1, prog: 100 }, { dur: 99, prog: 0 }] },
      { desc: 'decimal dur', acts: [{ dur: 8.5, prog: 40 }, { dur: 12.25, prog: 80 }] },
    ];

    for (const tc of testCases) {
      test(`reference match: ${tc.desc}`, () => {
        const oldInput = tc.acts.map((a) => ({
          duration_hours: a.dur,
          progress_percent: a.prog,
        }));
        const expected = referenceCalculateWeightedProgress(oldInput);

        const newInput = tc.acts.map((a, i) =>
          makeActivity({
            activityId: `act-${i}`,
            durationHours: a.dur,
            progressPercent: a.prog,
            status: (a.prog ?? 0) >= 100 ? 'completed' : (a.prog ?? 0) > 0 ? 'in_progress' : 'not_started',
          })
        );
        const result = calculateProgressMetrics(newInput);

        expect(result.weightedProgress).toBe(expected);
      });
    }
  });
});

// ─── Filtering Tests ─────────────────────────────────────────────────────────

describe('Activity Filtering', () => {
  test('should include non-cancelled activities', () => {
    expect(isActivityIncluded(makeActivity({ status: 'not_started' }))).toBe(true);
    expect(isActivityIncluded(makeActivity({ status: 'in_progress' }))).toBe(true);
    expect(isActivityIncluded(makeActivity({ status: 'completed' }))).toBe(true);
    expect(isActivityIncluded(makeActivity({ status: 'on_hold' }))).toBe(true);
  });

  test('should exclude cancelled activities', () => {
    expect(isActivityIncluded(makeActivity({ status: 'cancelled' }))).toBe(false);
  });

  test('filterIncludedActivities removes cancelled', () => {
    const filtered = filterIncludedActivities([
      makeActivity({ status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', status: 'cancelled' }),
      makeActivity({ activityId: 'act-3', status: 'completed' }),
    ]);
    expect(filtered).toHaveLength(2);
  });
});

// ─── Dimensional Progress Tests ──────────────────────────────────────────────

describe('Dimensional Progress', () => {
  test('should group by discipline', () => {
    const activities = [
      makeActivity({ disciplineId: 'mech', disciplineName: 'Mechanical', progressPercent: 50, durationHours: 10 }),
      makeActivity({ activityId: 'act-2', disciplineId: 'mech', disciplineName: 'Mechanical', progressPercent: 100, durationHours: 10, status: 'completed' }),
      makeActivity({ activityId: 'act-3', disciplineId: 'elec', disciplineName: 'Electrical', progressPercent: 30, durationHours: 20 }),
    ];
    const dims = calculateDisciplineProgress(activities);
    expect(dims).toHaveLength(2);

    const mech = dims.find((d) => d.key === 'mech');
    expect(mech).toBeDefined();
    expect(mech!.metrics.weightedProgress).toBe(75); // (50*10+100*10)/20

    const elec = dims.find((d) => d.key === 'elec');
    expect(elec).toBeDefined();
    expect(elec!.metrics.weightedProgress).toBe(30);
  });

  test('should group by workpack', () => {
    const activities = [
      makeActivity({ workpackId: 'wp-1', progressPercent: 100, durationHours: 10, status: 'completed' }),
      makeActivity({ activityId: 'act-2', workpackId: 'wp-2', progressPercent: 0, durationHours: 10 }),
    ];
    const dims = calculateWorkpackProgress(activities);
    expect(dims).toHaveLength(2);
    expect(dims.find((d) => d.key === 'wp-1')!.metrics.weightedProgress).toBe(100);
    expect(dims.find((d) => d.key === 'wp-2')!.metrics.weightedProgress).toBe(0);
  });
});

// ─── Identical Activity Intelligence Tests (Phase 2) ───────────────────────

describe('Identical Activity Intelligence', () => {
  test('20. should group by equipmentType + standardActivityTypeCode', () => {
    const activities = [
      makeActivity({ equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 100, status: 'completed', durationHours: 8 }),
      makeActivity({ activityId: 'act-2', equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 100, status: 'completed', durationHours: 8 }),
      makeActivity({ activityId: 'act-3', equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 50, durationHours: 8 }),
      makeActivity({ activityId: 'act-4', equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 0, durationHours: 8 }),
    ];
    const groups = calculateIdenticalActivityProgress(activities);
    expect(groups).toHaveLength(1);
    expect(groups[0].equipmentType).toBe('Heat Exchanger');
    expect(groups[0].standardActivityTypeCode).toBe('BLINDING');
    expect(groups[0].totalInstances).toBe(4);
    expect(groups[0].completedInstances).toBe(2);
    expect(groups[0].inProgressInstances).toBe(1);
    expect(groups[0].notStartedInstances).toBe(1);
    expect(groups[0].completionPercent).toBe(50);
    expect(groups[0].balancePercent).toBe(50);
  });

  test('21. should separate different equipment types', () => {
    const activities = [
      makeActivity({ equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 100, status: 'completed', durationHours: 8 }),
      makeActivity({ activityId: 'act-2', equipmentType: 'Vessel', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 0, durationHours: 8 }),
    ];
    const groups = calculateIdenticalActivityProgress(activities);
    expect(groups).toHaveLength(2);
    const hx = groups.find((g) => g.equipmentType === 'Heat Exchanger')!;
    const v = groups.find((g) => g.equipmentType === 'Vessel')!;
    expect(hx.completionPercent).toBe(100);
    expect(v.completionPercent).toBe(0);
  });

  test('22. should separate different activity types for same equipment', () => {
    const activities = [
      makeActivity({ equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 100, status: 'completed', durationHours: 8 }),
      makeActivity({ activityId: 'act-2', equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BUNDLE_PULL', standardActivityTypeName: 'Bundle Pullout', progressPercent: 0, durationHours: 16 }),
    ];
    const groups = calculateIdenticalActivityProgress(activities);
    expect(groups).toHaveLength(2);
    const blinding = groups.find((g) => g.standardActivityTypeCode === 'BLINDING')!;
    const bundle = groups.find((g) => g.standardActivityTypeCode === 'BUNDLE_PULL')!;
    expect(blinding.completionPercent).toBe(100);
    expect(bundle.completionPercent).toBe(0);
  });

  test('23. should skip activities without equipment type', () => {
    const activities = [
      makeActivity({ equipmentType: null, standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 100, status: 'completed', durationHours: 8 }),
    ];
    const groups = calculateIdenticalActivityProgress(activities);
    expect(groups).toHaveLength(0);
  });

  test('24. should exclude cancelled activities from identical grouping', () => {
    const activities = [
      makeActivity({ equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 100, status: 'completed', durationHours: 8 }),
      makeActivity({ activityId: 'act-2', equipmentType: 'Heat Exchanger', standardActivityTypeCode: 'BLINDING', standardActivityTypeName: 'Blinding', progressPercent: 0, status: 'cancelled', durationHours: 8 }),
    ];
    const groups = calculateIdenticalActivityProgress(activities);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalInstances).toBe(1);
    expect(groups[0].completedInstances).toBe(1);
    expect(groups[0].completionPercent).toBe(100);
  });

  test('25. should calculate duration-weighted progress within identical groups', () => {
    // 2 activities: one 8hr at 100%, one 16hr at 0%
    // Duration-weighted: (8*100 + 16*0) / (8+16) = 800/24 = 33%
    const activities = [
      makeActivity({ equipmentType: 'HX', standardActivityTypeCode: 'BLIND', standardActivityTypeName: 'Blinding', progressPercent: 100, status: 'completed', durationHours: 8 }),
      makeActivity({ activityId: 'act-2', equipmentType: 'HX', standardActivityTypeCode: 'BLIND', standardActivityTypeName: 'Blinding', progressPercent: 0, durationHours: 16 }),
    ];
    const groups = calculateIdenticalActivityProgress(activities);
    expect(groups[0].metrics.weightedProgress).toBe(33);
  });
});

describe('Equipment Type Progress', () => {
  test('26. should group by equipment type', () => {
    const activities = [
      makeActivity({ equipmentType: 'Heat Exchanger', progressPercent: 100, status: 'completed', durationHours: 8 }),
      makeActivity({ activityId: 'act-2', equipmentType: 'Heat Exchanger', progressPercent: 50, durationHours: 8 }),
      makeActivity({ activityId: 'act-3', equipmentType: 'Vessel', progressPercent: 0, durationHours: 10 }),
    ];
    const dims = calculateEquipmentTypeProgress(activities);
    expect(dims).toHaveLength(2);
    const hx = dims.find((d) => d.label === 'Heat Exchanger')!;
    expect(hx.metrics.weightedProgress).toBe(75);
    expect(hx.metrics.totalActivities).toBe(2);
  });
});

// ─── Phase 3 Regression Tests ───────────────────────────────────────────────

describe('Phase 3: Scope Change Denominator', () => {
  test('27. new scope activity changes denominator', () => {
    // Before scope change: 1000hrs, 600 completed equivalent → 60%
    const before = [
      makeActivity({ durationHours: 500, progressPercent: 100, status: 'completed' }),
      makeActivity({ activityId: 'act-2', durationHours: 500, progressPercent: 20 }),
    ];
    const metricsBefore = calculateProgressMetrics(before);
    expect(metricsBefore.weightedProgress).toBe(60);
    expect(metricsBefore.completedDurationHours).toBe(600);

    // After scope change: add 200hrs at 0% → total 1200hrs, 600 completed → 50%
    const after = [
      ...before,
      makeActivity({ activityId: 'act-scope', durationHours: 200, progressPercent: 0, status: 'not_started' }),
    ];
    const metricsAfter = calculateProgressMetrics(after);
    expect(metricsAfter.weightedProgress).toBe(50);
    expect(metricsAfter.totalDurationHours).toBe(1200);
    expect(metricsAfter.completedDurationHours).toBe(600);
    expect(metricsAfter.balanceDurationHours).toBe(600);
  });

  test('28. rejected/cancelled scope activity excluded', () => {
    const activities = [
      makeActivity({ durationHours: 500, progressPercent: 100, status: 'completed' }),
      makeActivity({ activityId: 'act-2', durationHours: 500, progressPercent: 20 }),
      makeActivity({ activityId: 'act-rejected', durationHours: 200, progressPercent: 0, status: 'cancelled' }),
    ];
    const metrics = calculateProgressMetrics(activities);
    // Cancelled is excluded: 1000hrs total, 600 completed → 60%
    expect(metrics.weightedProgress).toBe(60);
    expect(metrics.totalDurationHours).toBe(1000);
  });
});

describe('Phase 3: Cross-Dashboard Consistency', () => {
  test('29. same activities produce same progress regardless of call path', () => {
    const activities = [
      makeActivity({ durationHours: 8, progressPercent: 100, status: 'completed' }),
      makeActivity({ activityId: 'act-2', durationHours: 16, progressPercent: 50 }),
      makeActivity({ activityId: 'act-3', durationHours: 4, progressPercent: 0 }),
    ];
    // Call 1 — standard metrics
    const m1 = calculateProgressMetrics(activities);
    // Call 2 — via dimension (all in one discipline)
    const dims = calculateDisciplineProgress(activities.map(a => ({ ...a, disciplineId: 'disc-1', disciplineName: 'Mech' })));
    // Call 3 — via workpack (all share wp-1 from makeActivity default)
    const wps = calculateWorkpackProgress(activities);

    // All should produce the same weighted progress
    expect(m1.weightedProgress).toBe(dims[0].metrics.weightedProgress);
    expect(m1.weightedProgress).toBe(wps[0].metrics.weightedProgress);
  });

  test('30. progress boundaries — null values clamped correctly', () => {
    const activities = [
      makeActivity({ durationHours: 10, progressPercent: null as any }),
      makeActivity({ activityId: 'act-2', durationHours: 10, progressPercent: 100, status: 'completed' }),
    ];
    const metrics = calculateProgressMetrics(activities);
    // null progress treated as 0: (10*0 + 10*100) / 20 = 50%
    expect(metrics.weightedProgress).toBe(50);
  });
});

describe('Phase 3: SPI Adapter Consistency', () => {
  test('31. same progress used for SPI computation', () => {
    const activities = [
      makeActivity({ durationHours: 100, progressPercent: 60, status: 'in_progress' }),
      makeActivity({ activityId: 'act-2', durationHours: 100, progressPercent: 40, status: 'in_progress' }),
    ];
    const metrics = calculateProgressMetrics(activities);
    // 50% progress — SPI depends on planned progress which is external
    // This test verifies the progress BASE is deterministic
    expect(metrics.weightedProgress).toBe(50);
    expect(metrics.completedDurationHours).toBe(100);
    expect(metrics.balanceDurationHours).toBe(100);
  });
});
