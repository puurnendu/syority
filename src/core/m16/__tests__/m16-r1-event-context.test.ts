/**
 * M16-R1 Event Context Tests (E1–E5)
 *
 * Tests event context resolution: session reuse, WhatsApp session event,
 * missing context, ambiguous context, cross-event rejection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    whatsapp_sessions: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { resolveEventContext, setWhatsAppSessionEvent } from '../context/EventContextResolver';

describe('M16-R1 Event Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // E1: Existing event context reused
  it('E1 — existing session event context is reused', async () => {
    (prisma.event.findFirst as any).mockResolvedValue({
      id: 'event-1',
      code: 'TA-2027',
      name: 'Turnaround 2027',
      site_id: 'site-1',
      status: 'active',
    });

    const result = await resolveEventContext('org-A', 'whatsapp', 'event-1');

    expect(result.resolution).toBe('SESSION');
    expect(result.eventId).toBe('event-1');
    expect(result.eventCode).toBe('TA-2027');
    expect(prisma.event.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'event-1',
        organization_id: 'org-A',
        deleted_at: null,
      },
      select: expect.any(Object),
    });
  });

  // E2: WhatsApp session event context
  it('E2 — WhatsApp session event is persisted and reused', async () => {
    (prisma.whatsapp_sessions.update as any).mockResolvedValue({});

    await setWhatsAppSessionEvent('session-1', 'event-2');

    expect(prisma.whatsapp_sessions.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { event_id: 'event-2', updated_at: expect.any(Date) },
    });
  });

  // E3: Missing event context (no events)
  it('E3 — missing event context returns NONE', async () => {
    (prisma.event.findFirst as any).mockResolvedValue(null);
    (prisma.event.findMany as any).mockResolvedValue([]);

    const result = await resolveEventContext('org-B', 'whatsapp', null);

    expect(result.resolution).toBe('NONE');
    expect(result.eventId).toBeNull();
  });

  // E4: Ambiguous event context (multiple events)
  it('E4 — ambiguous event context returns AMBIGUOUS with candidates', async () => {
    (prisma.event.findMany as any).mockResolvedValue([
      { id: 'event-1', code: 'TA-2027', name: 'Turnaround 2027', site_id: 'site-1', status: 'active' },
      { id: 'event-2', code: 'TA-2028', name: 'Turnaround 2028', site_id: 'site-1', status: 'planning' },
    ]);

    const result = await resolveEventContext('org-A', 'whatsapp', null);

    expect(result.resolution).toBe('AMBIGUOUS');
    expect(result.eventId).toBeNull();
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates![0].code).toBe('TA-2027');
    expect(result.candidates![1].code).toBe('TA-2028');
  });

  // E4b: Single event auto-select
  it('E4b — single active event is auto-selected', async () => {
    (prisma.event.findMany as any).mockResolvedValue([
      { id: 'event-1', code: 'TA-2027', name: 'Turnaround 2027', site_id: 'site-1', status: 'active' },
    ]);

    const result = await resolveEventContext('org-A', 'web', null);

    expect(result.resolution).toBe('SINGLE_EVENT');
    expect(result.eventId).toBe('event-1');
    expect(result.eventCode).toBe('TA-2027');
  });

  // E5: Cross-event query rejected
  it('E5 — stale session event is rejected and falls through', async () => {
    // Session event is not found (deleted or from different org)
    (prisma.event.findFirst as any).mockResolvedValue(null);
    (prisma.event.findMany as any).mockResolvedValue([
      { id: 'event-2', code: 'TA-2028', name: 'Turnaround 2028', site_id: 'site-1', status: 'active' },
    ]);

    const result = await resolveEventContext('org-A', 'whatsapp', 'stale-event-id');

    // Falls through to single-event auto-select, not stale event
    expect(result.resolution).toBe('SINGLE_EVENT');
    expect(result.eventId).toBe('event-2');
  });
});
