/**
 * M8.10 — EVM Calculation Service Tests
 *
 * Comprehensive tests for all EVM formulas, earning rules, edge cases,
 * and mathematical invariants.
 *
 * Run: npx tsx --env-file=.env src/core/evm/__tests__/EvmCalculationService.test.ts
 */

import { test, expect } from 'vitest';

import {
  calculateBac,
  calculatePv,
  calculateEv,
  calculateAc,
  calculateCv,
  calculateSv,
  calculateCpi,
  calculateSpi,
  calculateEac,
  calculateEtc,
  calculateVac,
  calculateTcpi,
  calculateActivityEvm,
  calculateEventEvm,
  generateCurveData,
  type EvmActivityInput,
} from '../EvmCalculationService';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<EvmActivityInput> = {}): EvmActivityInput {
  return {
    activityId: 'test-activity-1',
    description: 'Test Activity',
    workpackId: 'test-wp-1',
    durationHours: 24,
    workCategory: 'EXECUTION',
    progressPercent: 50,
    actualCost: 5000,
    actualStart: new Date('2026-10-01'),
    actualEnd: null,
    plannedEnd: new Date('2026-10-04'),
    baselineBudgetedCost: 10000,
    baselinePlannedStart: new Date('2026-10-01'),
    baselinePlannedFinish: new Date('2026-10-04'),
    ...overrides,
  };
}

const DATA_DATE = new Date('2026-10-03');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(name);
    console.error(`  ❌ FAIL: ${name}`);
  }
}

function assertApprox(actual: number | null, expected: number | null, name: string, tolerance = 0.01): void {
  if (actual === null && expected === null) { passed++; return; }
  if (actual === null || expected === null) {
    failed++;
    failures.push(`${name} (got ${actual}, expected ${expected})`);
    console.error(`  ❌ FAIL: ${name} — got ${actual}, expected ${expected}`);
    return;
  }
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    passed++;
  } else {
    failed++;
    failures.push(`${name} (got ${actual}, expected ${expected}, diff ${diff})`);
    console.error(`  ❌ FAIL: ${name} — got ${actual}, expected ${expected}`);
  }
}

// ─── BAC Tests ───────────────────────────────────────────────────────────────

console.log('\n═══ BAC Tests ═══');

assert(calculateBac(makeInput({ baselineBudgetedCost: 10000 })) === 10000, 'BAC: normal value');
assert(calculateBac(makeInput({ baselineBudgetedCost: null })) === 0, 'BAC: null → 0');
assert(calculateBac(makeInput({ baselineBudgetedCost: 0 })) === 0, 'BAC: zero');

// ─── PV Tests ────────────────────────────────────────────────────────────────

console.log('\n═══ PV Tests ═══');

// Before planned start
assertApprox(
  calculatePv(makeInput(), new Date('2026-09-30')),
  0, 'PV: before planned start'
);

// At planned start
assertApprox(
  calculatePv(makeInput(), new Date('2026-10-01')),
  0, 'PV: at planned start'
);

// Midway (2 of 3 days elapsed = 66.67%)
assertApprox(
  calculatePv(makeInput(), new Date('2026-10-03')),
  10000 * (2/3), 'PV: midway through baseline', 1
);

// At planned finish
assertApprox(
  calculatePv(makeInput(), new Date('2026-10-04')),
  10000, 'PV: at planned finish'
);

// After planned finish
assertApprox(
  calculatePv(makeInput(), new Date('2026-10-10')),
  10000, 'PV: after planned finish'
);

// No BAC
assertApprox(
  calculatePv(makeInput({ baselineBudgetedCost: 0 }), DATA_DATE),
  0, 'PV: zero BAC'
);

// Missing baseline dates
assertApprox(
  calculatePv(makeInput({ baselinePlannedStart: null }), DATA_DATE),
  0, 'PV: missing baseline start'
);

// ─── EV Tests ────────────────────────────────────────────────────────────────

console.log('\n═══ EV Tests ═══');

// Normal activity: EV = BAC × progress/100
assertApprox(
  calculateEv(makeInput({ progressPercent: 50 })),
  5000, 'EV: normal 50%'
);

assertApprox(
  calculateEv(makeInput({ progressPercent: 100 })),
  10000, 'EV: normal 100%'
);

assertApprox(
  calculateEv(makeInput({ progressPercent: 0 })),
  0, 'EV: normal 0%'
);

// EV cap: progress > 100 should cap at BAC
assertApprox(
  calculateEv(makeInput({ progressPercent: 120 })),
  10000, 'EV: capped at BAC when progress > 100'
);

// Milestone: 0/100 rule
assertApprox(
  calculateEv(makeInput({ durationHours: 0, workCategory: 'MILESTONE', progressPercent: 50 })),
  0, 'EV: milestone at 50% → 0'
);

assertApprox(
  calculateEv(makeInput({ durationHours: 0, workCategory: 'MILESTONE', progressPercent: 100 })),
  10000, 'EV: milestone at 100% → BAC'
);

// Null duration treated as milestone
assertApprox(
  calculateEv(makeInput({ durationHours: null, progressPercent: 75 })),
  0, 'EV: null duration → milestone → 0'
);

// LOE: falls back to progress% in Phase 1
assertApprox(
  calculateEv(makeInput({ workCategory: 'LOE', progressPercent: 40 })),
  4000, 'EV: LOE at 40% (Phase 1 fallback)'
);

// Zero BAC
assertApprox(
  calculateEv(makeInput({ baselineBudgetedCost: 0, progressPercent: 100 })),
  0, 'EV: zero BAC → 0'
);

// Null progress
assertApprox(
  calculateEv(makeInput({ progressPercent: null })),
  0, 'EV: null progress → 0'
);

// ─── AC Tests ────────────────────────────────────────────────────────────────

console.log('\n═══ AC Tests ═══');

assert(calculateAc(makeInput({ actualCost: 8000 })) === 8000, 'AC: normal value');
assert(calculateAc(makeInput({ actualCost: null })) === 0, 'AC: null → 0');
assert(calculateAc(makeInput({ actualCost: 0 })) === 0, 'AC: zero');

// ─── CV Tests ────────────────────────────────────────────────────────────────

console.log('\n═══ CV Tests ═══');

assert(calculateCv(5000, 3000) === 2000, 'CV: under budget (positive)');
assert(calculateCv(3000, 5000) === -2000, 'CV: over budget (negative)');
assert(calculateCv(5000, 5000) === 0, 'CV: on budget');

// ─── SV Tests ────────────────────────────────────────────────────────────────

console.log('\n═══ SV Tests ═══');

assert(calculateSv(5000, 3000) === 2000, 'SV: ahead (positive)');
assert(calculateSv(3000, 5000) === -2000, 'SV: behind (negative)');
assert(calculateSv(5000, 5000) === 0, 'SV: on schedule');

// ─── CPI Tests ───────────────────────────────────────────────────────────────

console.log('\n═══ CPI Tests ═══');

assertApprox(calculateCpi(5000, 5000), 1.0, 'CPI: on budget');
assertApprox(calculateCpi(5000, 2500), 2.0, 'CPI: under budget');
assertApprox(calculateCpi(2500, 5000), 0.5, 'CPI: over budget');
assert(calculateCpi(0, 0) === 1.0, 'CPI: zero/zero → 1.0');
assert(calculateCpi(5000, 0) === null, 'CPI: EV>0, AC=0 → null');

// ─── SPI Tests ───────────────────────────────────────────────────────────────

console.log('\n═══ SPI Tests ═══');

assertApprox(calculateSpi(5000, 5000), 1.0, 'SPI: on schedule');
assertApprox(calculateSpi(5000, 2500), 2.0, 'SPI: ahead');
assertApprox(calculateSpi(2500, 5000), 0.5, 'SPI: behind');
assert(calculateSpi(0, 0) === 1.0, 'SPI: zero/zero → 1.0');
assert(calculateSpi(5000, 0) === null, 'SPI: EV>0, PV=0 → null');

// ─── EAC Tests ───────────────────────────────────────────────────────────────

console.log('\n═══ EAC Tests ═══');

// EAC = AC + ((BAC - EV) / CPI) = 5000 + ((10000 - 5000) / 1.0) = 10000
assertApprox(calculateEac(10000, 5000, 5000, 1.0), 10000, 'EAC: CPI=1.0');
// EAC = 5000 + ((10000 - 5000) / 0.5) = 5000 + 10000 = 15000
assertApprox(calculateEac(10000, 5000, 5000, 0.5), 15000, 'EAC: CPI=0.5 (overrun)');
assert(calculateEac(10000, 5000, 5000, null) === null, 'EAC: CPI=null → null');
assert(calculateEac(10000, 5000, 5000, 0) === null, 'EAC: CPI=0 → null');

// ─── ETC Tests ───────────────────────────────────────────────────────────────

console.log('\n═══ ETC Tests ═══');

assertApprox(calculateEtc(15000, 5000), 10000, 'ETC: normal');
assert(calculateEtc(null, 5000) === null, 'ETC: EAC=null → null');

// ─── VAC Tests ───────────────────────────────────────────────────────────────

console.log('\n═══ VAC Tests ═══');

assertApprox(calculateVac(10000, 10000), 0, 'VAC: on budget');
assertApprox(calculateVac(10000, 15000), -5000, 'VAC: overrun');
assert(calculateVac(10000, null) === null, 'VAC: EAC=null → null');

// ─── TCPI Tests ──────────────────────────────────────────────────────────────

console.log('\n═══ TCPI Tests ═══');

// TCPI = (BAC - EV) / (BAC - AC) = (10000 - 5000) / (10000 - 5000) = 1.0
assertApprox(calculateTcpi(10000, 5000, 5000), 1.0, 'TCPI: on track');
// TCPI = (10000 - 2500) / (10000 - 5000) = 7500 / 5000 = 1.5
assertApprox(calculateTcpi(10000, 2500, 5000), 1.5, 'TCPI: behind');
assert(calculateTcpi(10000, 5000, 10000) === null, 'TCPI: BAC=AC → null');

// ─── Mathematical Invariant Tests ────────────────────────────────────────────

console.log('\n═══ Invariant Tests ═══');

const input1 = makeInput({ progressPercent: 60, actualCost: 7000 });
const result1 = calculateActivityEvm(input1, DATA_DATE);

// CV = EV - AC
assertApprox(result1.cv, result1.ev - result1.ac, 'Invariant: CV = EV - AC');
// SV = EV - PV
assertApprox(result1.sv, result1.ev - result1.pv, 'Invariant: SV = EV - PV');
// EV <= BAC
assert(result1.ev <= result1.bac, 'Invariant: EV <= BAC');

// ─── Event-Level Aggregation Tests ───────────────────────────────────────────

console.log('\n═══ Event-Level Tests ═══');

const activities: EvmActivityInput[] = [
  makeInput({ activityId: 'a1', progressPercent: 100, actualCost: 10000, baselineBudgetedCost: 10000 }),
  makeInput({ activityId: 'a2', progressPercent: 50, actualCost: 5000, baselineBudgetedCost: 8000 }),
  makeInput({ activityId: 'a3', progressPercent: 0, actualCost: 0, baselineBudgetedCost: 5000 }),
  makeInput({ activityId: 'a4', progressPercent: 0, actualCost: 0, baselineBudgetedCost: 0 }), // no cost
];

const eventResult = calculateEventEvm(activities, 'event-1', 'baseline-1', DATA_DATE);

assert(eventResult.bac === 23000, 'Event: BAC aggregation');
assert(eventResult.costLoadedActivities === 3, 'Event: cost-loaded count');
assert(eventResult.totalActivities === 4, 'Event: total count');
assertApprox(eventResult.costLoadedPercent, 75, 'Event: cost-loaded %');

// Event-level invariants
assertApprox(eventResult.cv, eventResult.ev - eventResult.ac, 'Event invariant: CV = EV - AC');
assertApprox(eventResult.sv, eventResult.ev - eventResult.pv, 'Event invariant: SV = EV - PV');

// ─── Curve Generation Tests ──────────────────────────────────────────────────

console.log('\n═══ Curve Tests ═══');

const curveActivities = [makeInput()];
const curve = generateCurveData(curveActivities, new Date('2026-10-01'), new Date('2026-10-04'));

assert(curve.dates.length === 4, 'Curve: 4 date points');
assert(curve.pv.length === 4, 'Curve: 4 PV points');
assert(curve.ev.length === 4, 'Curve: 4 EV points');
assert(curve.ac.length === 4, 'Curve: 4 AC points');
// PV should be monotonically non-decreasing
for (let i = 1; i < curve.pv.length; i++) {
  assert(curve.pv[i] >= curve.pv[i - 1], `Curve: PV monotonic at index ${i}`);
}

// ─── Edge Case Tests ─────────────────────────────────────────────────────────

console.log('\n═══ Edge Case Tests ═══');

// Activity with no baseline cost
const noBac = makeInput({ baselineBudgetedCost: null, progressPercent: 100, actualCost: 5000 });
const noBacResult = calculateActivityEvm(noBac, DATA_DATE);
assert(noBacResult.bac === 0, 'Edge: no BAC → bac=0');
assert(noBacResult.pv === 0, 'Edge: no BAC → pv=0');
assert(noBacResult.ev === 0, 'Edge: no BAC → ev=0');
assert(noBacResult.ac === 5000, 'Edge: no BAC → ac still tracked');

// Activity with no dates
const noDates = makeInput({ baselinePlannedStart: null, baselinePlannedFinish: null });
const noDatesResult = calculateActivityEvm(noDates, DATA_DATE);
assert(noDatesResult.pv === 0, 'Edge: no dates → pv=0');

// Completed activity
const complete = makeInput({ progressPercent: 100, actualCost: 12000 });
const completeResult = calculateActivityEvm(complete, DATA_DATE);
assertApprox(completeResult.ev, 10000, 'Edge: completed → EV=BAC');
assert(completeResult.cv < 0, 'Edge: completed over budget → negative CV');

// ─── No Infinity/NaN Leakage Tests ──────────────────────────────────────────

console.log('\n═══ No Infinity/NaN Leakage Tests ═══');

const weirdInputs: EvmActivityInput[] = [
  makeInput({ baselineBudgetedCost: 0, actualCost: 0, progressPercent: 0 }),
  makeInput({ baselineBudgetedCost: null, actualCost: null, progressPercent: null }),
  makeInput({ baselineBudgetedCost: 0, actualCost: 100, progressPercent: 100 }),
];

for (const wi of weirdInputs) {
  const r = calculateActivityEvm(wi, DATA_DATE);
  assert(!Object.values(r).some(v => typeof v === 'number' && (!isFinite(v) || isNaN(v))),
    `No Inf/NaN: ${wi.description}`);
}

const weirdEvent = calculateEventEvm(weirdInputs, 'e', 'b', DATA_DATE);
const numericFields = ['bac', 'pv', 'ev', 'ac', 'cv', 'sv', 'cpi', 'spi', 'eac', 'etc', 'vac', 'tcpi'] as const;
for (const field of numericFields) {
  const val = weirdEvent[field];
  if (val !== null) {
    assert(isFinite(val) && !isNaN(val), `No Inf/NaN in event.${field}`);
  } else {
    passed++; // null is acceptable
  }
}

// ─── Results ─────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log(`  M8.10 EVM CALCULATION TESTS`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log('═══════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}

if (failed > 0) {
  throw new Error(`${failed} tests failed`);
}

test('EvmCalculationService manual tests passed', () => {
  expect(failed).toBe(0);
});
