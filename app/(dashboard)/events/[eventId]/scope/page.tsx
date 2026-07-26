import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { AdvancedScopeClient } from './AdvancedScopeClient';

export default async function EventScopePage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  if (!hasPermission(role, 'event:view')) redirect('/dashboard');
  const canManage = hasPermission(role, 'event:manage');

  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    include: {
      site: { select: { id: true, name: true, code: true } },
      eventUnits: { select: { unit_id: true } },
      eventSystems: { select: { system_id: true } },
    },
  });
  if (!event) notFound();

  // Load all available units and systems for this site
  const siteUnits = await prisma.unit.findMany({
    where: { site_id: event.site_id, organization_id: orgId },
    include: {
      systems: { select: { id: true, name: true, code: true } }
    },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 h-full flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/events" className="hover:text-gray-700">Events</Link>
          {' > '}
          <Link href={`/events/${eventId}`} className="hover:text-gray-700">{event.code}</Link>
          {' > Scope'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Scope Planning</h1>
        <p className="text-sm text-gray-500 mt-0.5">Drag and drop units or systems into the event scope.</p>
      </div>
      
      <div className="flex-1 min-h-0">
        <AdvancedScopeClient
          eventId={eventId}
          siteUnits={siteUnits}
          initialEventUnits={event.eventUnits.map(eu => eu.unit_id)}
          initialEventSystems={event.eventSystems.map(es => es.system_id)}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
