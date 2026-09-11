/**
 * R0.4-E — Event-authoritative CPM enqueue adapter.
 *
 * M11 remains the sole CPM authority. This module only queues
 * ScheduleOrchestrationService.calculateEventSchedule for a known Event.
 *
 * It does not infer Event from Project, dates, plant, or UUID.
 */

import { prisma } from '@/lib/prisma';
import { scheduleRecalculateQueue } from '@/lib/queues';

export type EnqueueEventScheduleCode =
  | 'EVENT_REQUIRED'
  | 'CROSS_TENANT_EVENT'
  | 'NO_WORKPACK';

export type EnqueueEventScheduleResult =
  | { enqueued: true; eventId: string }
  | { enqueued: false; code: EnqueueEventScheduleCode };

export async function enqueueEventScheduleRecalculate(input: {
  organizationId: string;
  eventId?: string | null;
  workpackId?: string | null;
}): Promise<EnqueueEventScheduleResult> {
  const orgId = input.organizationId;
  let eventId = input.eventId ?? null;

  if (!eventId && input.workpackId) {
    const workpack = await prisma.workpack.findFirst({
      where: { id: input.workpackId, organization_id: orgId, deleted_at: null },
      select: { event_id: true },
    });
    if (!workpack) {
      return { enqueued: false, code: 'NO_WORKPACK' };
    }
    eventId = workpack.event_id;
  }

  if (!eventId) {
    return { enqueued: false, code: 'EVENT_REQUIRED' };
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!event) {
    return { enqueued: false, code: 'CROSS_TENANT_EVENT' };
  }

  await scheduleRecalculateQueue.add(
    'recalculate',
    { eventId, orgId },
    {
      jobId: `recalc-${eventId}`,
      removeOnComplete: 100,
    }
  );

  return { enqueued: true, eventId };
}
