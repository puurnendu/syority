/**
 * M16 — Event Context Resolver
 *
 * Determines the active event for an M16 interaction.
 *
 * RESOLUTION ORDER:
 *   1. Session state (whatsapp_sessions.event_id or syority_active_event cookie)
 *   2. Single active event auto-select (org has exactly one active event)
 *   3. AMBIGUOUS (multiple events, user must select)
 *   4. NONE (no events available)
 *
 * REUSES existing platform mechanisms:
 *   - getActiveShutdownServer() for web channel
 *   - syority_active_event cookie for browser sessions
 *   - whatsapp_sessions.event_id for WhatsApp conversation continuity
 *
 * DOES NOT introduce User.active_event_id.
 */

import { prisma } from '@/lib/prisma';
import type { M16Channel, EventContextResult, EventResolution } from '../types';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve event context for an M16 interaction.
 *
 * @param organizationId - Trusted org ID from authenticated user
 * @param channel        - The interaction channel
 * @param sessionEventId - Event ID from session state (if available)
 */
export async function resolveEventContext(
  organizationId: string,
  channel: M16Channel,
  sessionEventId?: string | null
): Promise<EventContextResult> {
  // Step 1: If session has an event, validate it
  if (sessionEventId) {
    const sessionEvent = await prisma.event.findFirst({
      where: {
        id: sessionEventId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        site_id: true,
        status: true,
      },
    });

    if (sessionEvent) {
      return {
        eventId: sessionEvent.id,
        eventCode: sessionEvent.code,
        eventName: sessionEvent.name,
        siteId: sessionEvent.site_id,
        resolution: 'SESSION',
      };
    }
    // Session event is stale/deleted — fall through to auto-select
  }

  // Step 2: Find all active/in-progress events for this org
  const activeEvents = await prisma.event.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: { in: ['active', 'in_progress', 'execution', 'planning'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      site_id: true,
      status: true,
    },
    orderBy: [{ planned_start: 'desc' }, { created_at: 'desc' }],
  });

  // Step 3: No events
  if (activeEvents.length === 0) {
    return {
      eventId: null,
      eventCode: null,
      eventName: null,
      siteId: null,
      resolution: 'NONE',
    };
  }

  // Step 4: Exactly one event — auto-select
  if (activeEvents.length === 1) {
    const event = activeEvents[0];
    return {
      eventId: event.id,
      eventCode: event.code,
      eventName: event.name,
      siteId: event.site_id,
      resolution: 'SINGLE_EVENT',
    };
  }

  // Step 5: Multiple events — ambiguous
  return {
    eventId: null,
    eventCode: null,
    eventName: null,
    siteId: null,
    resolution: 'AMBIGUOUS',
    candidates: activeEvents.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
    })),
  };
}

/**
 * Persist event selection to a WhatsApp session.
 * Called after user selects an event from ambiguity prompt.
 */
export async function setWhatsAppSessionEvent(
  sessionId: string,
  eventId: string
): Promise<void> {
  await prisma.whatsapp_sessions.update({
    where: { id: sessionId },
    data: { event_id: eventId, updated_at: new Date() },
  });
}
