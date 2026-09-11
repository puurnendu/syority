import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Server-side helper to read the active shutdown ID from cookies.
 * Validates that the event exists and belongs to the specified organization.
 */
export async function getActiveShutdownServer(organizationId: string): Promise<{
  activeEventId: string | null;
  activeShutdown: any | null;
}> {
  try {
    const cookieStore = await cookies();
    const cookieEventId = cookieStore.get('syority_active_event')?.value;

    if (cookieEventId) {
      const event = await prisma.event.findFirst({
        where: {
          id: cookieEventId,
          organization_id: organizationId,
          deleted_at: null,
        },
        include: {
          site: { select: { id: true, name: true, code: true } },
          discipline: { select: { id: true, name: true, code: true } },
        },
      });

      if (event) {
        return {
          activeEventId: event.id,
          activeShutdown: event,
        };
      }
    }

    // Fallback: pick the first active/in-progress event, or most recent event
    const fallbackEvent = await prisma.event.findFirst({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        discipline: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ planned_start: 'desc' }, { created_at: 'desc' }],
    });

    return {
      activeEventId: fallbackEvent ? fallbackEvent.id : null,
      activeShutdown: fallbackEvent || null,
    };
  } catch (error) {
    console.error('[getActiveShutdownServer] Error resolving active shutdown:', error);
    return {
      activeEventId: null,
      activeShutdown: null,
    };
  }
}
