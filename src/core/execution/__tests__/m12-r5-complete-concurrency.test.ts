/**
 * M16-R5 P1-4 — Concurrent COMPLETE against ExecutionWriteService.
 *
 * Proves the updateMany(status = expectedStatus) predicate:
 * two COMPLETE calls that both read the same stale in_progress row
 * cannot both commit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => {
  const activityStore = {
    id: 'act-conc-1',
    organization_id: 'org-conc',
    status: 'in_progress' as string,
    deleted_at: null as Date | null,
    progress_percent: 80,
    workpack_id: 'wp-conc',
    hold_point_type: null as string | null,
    actual_start: new Date('2026-01-01'),
    actual_end: null as Date | null,
    planned_start: new Date('2026-01-01'),
    notes: null as string | null,
    site_id: null as string | null,
    updated_by: null as string | null,
  };

  const state = {
    readers: 0,
    releaseReaders: () => {},
    bothHaveRead: Promise.resolve(),
  };

  function resetBarrier() {
    state.readers = 0;
    state.bothHaveRead = new Promise<void>((resolve) => {
      state.releaseReaders = resolve;
    });
  }
  resetBarrier();

  const tx = {
    activity: {
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        await new Promise((r) => setImmediate(r));
        if (
          activityStore.id === where.id &&
          activityStore.organization_id === where.organization_id &&
          activityStore.status === where.status &&
          activityStore.deleted_at === null
        ) {
          Object.assign(activityStore, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
      findFirst: async () => ({ ...activityStore }),
    },
    progressLog: {
      create: async ({ data }: { data: any }) => data,
    },
  };

  async function staleReadFindFirst() {
    state.readers += 1;
    if (state.readers >= 2) state.releaseReaders();
    await state.bothHaveRead;
    return {
      ...activityStore,
      status: 'in_progress',
      workpack: { status: 'issued' },
      qa_clearance_records: [],
    };
  }

  const prisma = {
    activity: {
      findFirst: vi.fn(staleReadFindFirst),
    },
    qa_clearance_records: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: async (cb: (t: typeof tx) => Promise<void>) => cb(tx),
  };

  return { activityStore, resetBarrier, staleReadFindFirst, prisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma.prisma }));
vi.mock('@/lib/audit', () => ({
  AuditService: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));
vi.mock('../FieldExecutionService', () => ({
  FieldExecutionService: { syncWorkpackProgress: vi.fn().mockResolvedValue(undefined) },
}));

import { ExecutionWriteService } from '../ExecutionWriteService';

describe('EWS concurrent COMPLETE', () => {
  beforeEach(() => {
    mockPrisma.resetBarrier();
    mockPrisma.activityStore.status = 'in_progress';
    mockPrisma.activityStore.progress_percent = 80;
    mockPrisma.activityStore.actual_end = null;
    mockPrisma.prisma.activity.findFirst.mockImplementation(mockPrisma.staleReadFindFirst);
  });

  it('Promise.all two COMPLETE: one success, one conflict', async () => {
    const params = {
      activityId: 'act-conc-1',
      action: 'COMPLETE' as const,
    };

    const results = await Promise.allSettled([
      ExecutionWriteService.applyAction('org-conc', 'user-a', params, { source_channel: 'mobile' }),
      ExecutionWriteService.applyAction('org-conc', 'user-b', params, { source_channel: 'mobile' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain(
      'Execution conflict: activity was modified concurrently'
    );
    expect(mockPrisma.activityStore.status).toBe('completed');
  });

  it('sequential second COMPLETE is rejected by state machine', async () => {
    mockPrisma.prisma.activity.findFirst.mockImplementation(async () => ({
      ...mockPrisma.activityStore,
      workpack: { status: 'issued' },
      qa_clearance_records: [],
    }));

    await ExecutionWriteService.applyAction(
      'org-conc',
      'user-a',
      { activityId: 'act-conc-1', action: 'COMPLETE' },
      { source_channel: 'web' }
    );
    expect(mockPrisma.activityStore.status).toBe('completed');

    await expect(
      ExecutionWriteService.applyAction(
        'org-conc',
        'user-b',
        { activityId: 'act-conc-1', action: 'COMPLETE' },
        { source_channel: 'web' }
      )
    ).rejects.toThrow(/already completed/);
  });
});
