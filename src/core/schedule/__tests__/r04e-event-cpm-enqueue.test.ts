/**
 * R0.4-E — Event-authoritative CPM enqueue behaviour.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { scheduleRecalculateQueue } from '@/lib/queues';
import { enqueueEventScheduleRecalculate } from '../enqueueEventScheduleRecalculate';
import { ScheduleOrchestrationService } from '../ScheduleOrchestrationService';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const EVENT_A = 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WP_A = 'waaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WP_NONE = 'wnnnnnnn-nnnn-4nnn-8nnn-nnnnnnnnnnnn';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workpack: { findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/queues', () => ({
  scheduleRecalculateQueue: { add: vi.fn(async () => ({})) },
}));

describe('R0.4-E CPM enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test A — Workpack.event_id = Event A queues Event A, not Project', async () => {
    (prisma.workpack.findFirst as any).mockResolvedValue({ event_id: EVENT_A });
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVENT_A });

    const result = await enqueueEventScheduleRecalculate({
      organizationId: ORG_A,
      workpackId: WP_A,
    });

    expect(result).toEqual({ enqueued: true, eventId: EVENT_A });
    expect(scheduleRecalculateQueue.add).toHaveBeenCalledWith(
      'recalculate',
      { eventId: EVENT_A, orgId: ORG_A },
      expect.objectContaining({ jobId: `recalc-${EVENT_A}` })
    );
    const payload = (scheduleRecalculateQueue.add as any).mock.calls[0][1];
    expect(payload.projectId).toBeUndefined();
  });

  it('Test B — Event-less Workpack does not enqueue and does not guess Event', async () => {
    (prisma.workpack.findFirst as any).mockResolvedValue({ event_id: null });

    const result = await enqueueEventScheduleRecalculate({
      organizationId: ORG_A,
      workpackId: WP_NONE,
    });

    expect(result).toEqual({ enqueued: false, code: 'EVENT_REQUIRED' });
    expect(scheduleRecalculateQueue.add).not.toHaveBeenCalled();
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it('Test C — cross-tenant Event is rejected', async () => {
    (prisma.event.findFirst as any).mockResolvedValue(null);

    const result = await enqueueEventScheduleRecalculate({
      organizationId: ORG_B,
      eventId: EVENT_A,
    });

    expect(result).toEqual({ enqueued: false, code: 'CROSS_TENANT_EVENT' });
    expect(scheduleRecalculateQueue.add).not.toHaveBeenCalled();
    expect(prisma.event.findFirst).toHaveBeenCalledWith({
      where: { id: EVENT_A, organization_id: ORG_B, deleted_at: null },
      select: { id: true },
    });
  });

  it('Test D — production Event path does not use resolveEventIdFromProject', () => {
    expect((ScheduleOrchestrationService as any).resolveEventIdFromProject).toBeUndefined();
  });

  it('uses Activity.event_id when supplied without guessing from Workpack', async () => {
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVENT_A });

    const result = await enqueueEventScheduleRecalculate({
      organizationId: ORG_A,
      eventId: EVENT_A,
      workpackId: WP_NONE,
    });

    expect(result.enqueued).toBe(true);
    expect(prisma.workpack.findFirst).not.toHaveBeenCalled();
  });
});
