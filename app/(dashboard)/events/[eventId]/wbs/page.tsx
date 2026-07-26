import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { EventWbsManagerClient } from './EventWbsManagerClient';

export default async function EventWbsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  
  // Basic check, might need specific event WBS permissions
  if (!hasPermission(role, 'event:view')) redirect('/dashboard');
  const canManage = hasPermission(role, 'event:manage');

  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
  });
  if (!event) notFound();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          <Link href="/events" className="hover:text-gray-700">Events</Link>
          {' > '}
          <Link href={`/events/${eventId}`} className="hover:text-gray-700">{event.code}</Link>
          {' > WBS'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Event WBS Manager</h1>
        <p className="text-sm text-gray-500 mt-0.5">{event.name}</p>
      </div>
      <EventWbsManagerClient
        eventId={eventId}
        eventName={event.name}
        canManage={canManage}
      />
    </div>
  );
}
