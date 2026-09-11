/**
 * M12 — Execution fact integrity.
 *
 * Proves COMPLETE can never turn a planned timestamp into an actual
 * execution timestamp.
 *
 * Invariant under test:
 *   planned_start MUST NEVER populate actual_start.
 *
 * Established M12 semantics (unchanged by this suite):
 *   START               → actual_start = execution timestamp
 *   UPDATE_PROGRESS >0  → actual_start = execution timestamp when absent
 *   COMPLETE            → actual_end   = execution timestamp;
 *                         existing actual_start preserved
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const PLANNED_START = new Date('2027-04-10T09:00:00.000Z');
const PLANNED_END = new Date('2027-04-10T17:00:00.000Z');
const ACTUAL_START_1000 = new Date('2027-04-10T10:00:00.000Z');
const START_AT_1030 = '2027-04-10T10:30:00.000Z';
const PROGRESS_AT_1115 = '2027-04-10T11:15:00.000Z';
const COMPLETE_AT_1500 = '2027-04-10T15:00:00.000Z';

const h = vi.hoisted(() => {
  const store: Record<string, any> = {};

  const progressLogs: any[] = [];
  const auditCalls: any[] = [];

  const tx = {
    activity: {
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        if (
          store.id === where.id &&
          store.organization_id === where.organization_id &&
          store.status === where.status &&
          store.deleted_at === null
        ) {
          Object.assign(store, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
      findFirst: async () => ({ ...store }),
    },
    progressLog: {
      create: async ({ data }: { data: any }) => {
        progressLogs.push(data);
        return data;
      },
    },
  };

  const prisma = {
    activity: {
      findFirst: vi.fn(async () => ({
        ...store,
        workpack: { status: 'issued', event_id: null },
        qa_clearance_records: [],
      })),
    },
    qa_clearance_records: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: async (cb: (t: typeof tx) => Promise<void>) => cb(tx),
  };

  return { store, prisma, progressLogs, auditCalls, tx };
});

vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }));
vi.mock('@/lib/audit', () => ({
  AuditService: {
    log: vi.fn(async (payload: any) => {
      h.auditCalls.push(payload);
    }),
  },
}));
vi.mock('@/lib/eventBus', () => ({ eventBus: { emit: vi.fn() } }));
vi.mock('../FieldExecutionService', () => ({
  FieldExecutionService: { syncWorkpackProgress: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../ExecutionReadinessService', () => ({
  ExecutionReadinessService: {
    evaluateReadiness: vi.fn().mockResolvedValue({ is_ready: true, blockers: [] }),
  },
}));

import { ExecutionWriteService } from '../ExecutionWriteService';
import { eventBus } from '@/lib/eventBus';
import { FieldExecutionService } from '../FieldExecutionService';

const ORG = 'org-m12-integrity';
const USER = 'user-m12';
const ACT = 'act-m12-integrity';

function seed(overrides: Record<string, any> = {}) {
  for (const k of Object.keys(h.store)) delete h.store[k];
  Object.assign(h.store, {
    id: ACT,
    organization_id: ORG,
    status: 'released',
    deleted_at: null,
    progress_percent: 0,
    workpack_id: 'wp-m12',
    event_id: null,
    hold_point_type: null,
    planned_start: PLANNED_START,
    planned_end: PLANNED_END,
    actual_start: null,
    actual_end: null,
    notes: null,
    site_id: null,
    updated_by: null,
    ...overrides,
  });
}

const complete = () =>
  ExecutionWriteService.applyAction(
    ORG,
    USER,
    { activityId: ACT, action: 'COMPLETE', execution_date: COMPLETE_AT_1500 },
    { source_channel: 'web' }
  );

describe('M12 execution fact integrity — COMPLETE never fabricates actual_start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.progressLogs.length = 0;
    h.auditCalls.length = 0;
    seed();
  });

  it('T1 — COMPLETE preserves an existing actual_start', async () => {
    seed({ status: 'in_progress', progress_percent: 60, actual_start: ACTUAL_START_1000 });

    await complete();

    expect(h.store.actual_start.getTime()).toBe(ACTUAL_START_1000.getTime());
    expect(h.store.actual_end.getTime()).toBe(new Date(COMPLETE_AT_1500).getTime());
    expect(h.store.actual_start.getTime()).not.toBe(PLANNED_START.getTime());
    expect(h.store.status).toBe('completed');
    expect(h.store.progress_percent).toBe(100);
  });

  it('T2 — COMPLETE with missing actual_start never adopts planned_start', async () => {
    seed({ actual_start: null, planned_start: PLANNED_START });

    await complete();

    // The invariant.
    expect(h.store.actual_start.getTime()).not.toBe(PLANNED_START.getTime());
    expect(h.store.actual_start).not.toEqual(PLANNED_START);

    // Established semantics: execution timestamp, matching UPDATE_PROGRESS at 100%.
    expect(h.store.actual_start.getTime()).toBe(new Date(COMPLETE_AT_1500).getTime());
    expect(h.store.actual_end.getTime()).toBe(new Date(COMPLETE_AT_1500).getTime());

    // planned_start itself is untouched by execution.
    expect(h.store.planned_start.getTime()).toBe(PLANNED_START.getTime());
  });

  it('T3 — START then COMPLETE keeps the START timestamp', async () => {
    seed({ status: 'released', actual_start: null });

    await ExecutionWriteService.applyAction(
      ORG,
      USER,
      { activityId: ACT, action: 'START', execution_date: START_AT_1030 },
      { source_channel: 'web' }
    );

    expect(h.store.actual_start.getTime()).toBe(new Date(START_AT_1030).getTime());

    await complete();

    expect(h.store.actual_start.getTime()).toBe(new Date(START_AT_1030).getTime());
    expect(h.store.actual_end.getTime()).toBe(new Date(COMPLETE_AT_1500).getTime());
    expect(h.store.actual_start.getTime()).not.toBe(PLANNED_START.getTime());
  });

  it('T4 — UPDATE_PROGRESS then COMPLETE keeps the first execution timestamp', async () => {
    seed({ status: 'released', actual_start: null });

    await ExecutionWriteService.applyAction(
      ORG,
      USER,
      { activityId: ACT, action: 'UPDATE_PROGRESS', progress: 50, execution_date: PROGRESS_AT_1115 },
      { source_channel: 'mobile' }
    );

    expect(h.store.actual_start.getTime()).toBe(new Date(PROGRESS_AT_1115).getTime());

    await complete();

    expect(h.store.actual_start.getTime()).toBe(new Date(PROGRESS_AT_1115).getTime());
    expect(h.store.actual_end.getTime()).toBe(new Date(COMPLETE_AT_1500).getTime());
    expect(h.store.actual_start.getTime()).not.toBe(PLANNED_START.getTime());
  });

  it('T5 — planned_start NULL introduces no fabricated planning value', async () => {
    seed({ planned_start: null, planned_end: null, actual_start: null });

    await complete();

    expect(h.store.actual_start).toBeInstanceOf(Date);
    expect(Number.isNaN(h.store.actual_start.getTime())).toBe(false);
    expect(h.store.actual_start.getTime()).toBe(new Date(COMPLETE_AT_1500).getTime());
    expect(h.store.planned_start).toBeNull();
  });

  it('T6 — ProgressLog, AuditLog, EventBus and M8.13 sync remain intact', async () => {
    seed({ actual_start: null });

    await complete();

    // ProgressLog written inside the transaction.
    expect(h.progressLogs).toHaveLength(1);
    expect(h.progressLogs[0].activity_id).toBe(ACT);
    expect(h.progressLogs[0].progress_percent).toBe(100);

    // AuditLog captures both old and new actual_start.
    expect(h.auditCalls).toHaveLength(1);
    expect(h.auditCalls[0].model_name).toBe('Activity');
    expect(h.auditCalls[0].old_values.actual_start).toBeNull();
    expect(h.auditCalls[0].new_values.actual_start.getTime()).toBe(
      new Date(COMPLETE_AT_1500).getTime()
    );

    // EventBus unchanged.
    const emitted = (eventBus.emit as any).mock.calls.map((c: any[]) => c[0]);
    expect(emitted).toContain('ActivityCompleted');
    expect(emitted).toContain('ActivityProgressUpdated');

    // M8.13 aggregation still invoked; M12 does not calculate progress itself.
    expect(FieldExecutionService.syncWorkpackProgress).toHaveBeenCalledWith(ORG, 'wp-m12');
  });

  it('guard — the COMPLETE branch contains no planned_start fallback', () => {
    const src = readFileSync(
      path.resolve(process.cwd(), 'src/core/execution/ExecutionWriteService.ts'),
      'utf8'
    );
    const completeBranch = src.slice(
      src.indexOf("} else if (params.action === 'COMPLETE') {"),
      src.indexOf("} else if (params.action === 'VERIFY') {")
    );
    expect(completeBranch).toContain('actual_end: executionDate');
    expect(completeBranch).toContain('updates.actual_start = executionDate');
    expect(completeBranch).not.toMatch(/updates\.actual_start\s*=\s*[^;]*planned_start/);
  });
});
