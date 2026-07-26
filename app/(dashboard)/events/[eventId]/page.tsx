import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import EventActionsClient from './EventActionsClient';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    include: {
      site: { select: { id: true, name: true, code: true } },
      eventUnits: {
        include: { unit: { select: { id: true, name: true, code: true } } },
      },
      _count: { select: { Workpack: true } },
    },
  });
  if (!event) notFound();

  const workpacks = await prisma.workpack.findMany({
    where: { event_id: eventId, deleted_at: null },
    select: { id: true, title: true, workpack_id_code: true, status: true },
    orderBy: { updated_at: 'desc' },
    take: 20,
  });

  const availableUnits = await prisma.unit.findMany({
    where: { site_id: event.site_id, organization_id: orgId },
    select: { id: true, name: true, code: true }
  });

  const initialSelectedUnits = event.eventUnits.map(eu => eu.unit.id);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/events" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {event.code} — {event.name}
        </h1>
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
          {event.event_type}
        </span>
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
          {event.status}
        </span>
        <Link
          href={`/events/${eventId}/ta-dashboard`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
        >
          📊 TA Dashboard
        </Link>
        <Link
          href={`/events/${eventId}/safety`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50"
        >
          🦺 Safety
        </Link>
        <Link
          href={`/events/${eventId}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50"
        >
          ✏️ Edit Details
        </Link>
        <Link
          href={`/events/${eventId}/phases`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50"
        >
          ⏱️ Phases
        </Link>
        <EventActionsClient eventId={eventId} currentStatus={event.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Site</dt>
            <dd>{event.site?.name ?? '—'}</dd>
            <dt className="text-gray-500">Planned start</dt>
            <dd>{event.planned_start ? new Date(event.planned_start).toLocaleDateString() : '—'}</dd>
            <dt className="text-gray-500">Planned end</dt>
            <dd>{event.planned_end ? new Date(event.planned_end).toLocaleDateString() : '—'}</dd>
            <dt className="text-gray-500">Workpacks</dt>
            <dd>{event._count.workpacks}</dd>
          </dl>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Units in scope</h2>
          {event.eventUnits.length === 0 ? (
            <p className="text-sm text-gray-500">No units assigned. Use the API to add units to this event.</p>
          ) : (
            <ul className="space-y-1">
              {event.eventUnits.map((eu) => (
                <li key={eu.id} className="text-sm text-gray-700 font-medium">
                  • {eu.unit?.name} {eu.unit?.code ? `(${eu.unit.code})` : ''}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link 
              href={`/events/${eventId}/scope`}
              className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 font-medium inline-flex items-center gap-1"
            >
              Manage Scope
            </Link>
          </div>
        </section>
      </div>

      <section className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Workpacks in this event</h2>
        {workpacks.length === 0 ? (
          <p className="text-sm text-gray-500">No workpacks linked to this event yet.</p>
        ) : (
          <ul className="space-y-2">
            {workpacks.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/workpacks/${w.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {w.workpack_id_code ?? w.title}
                </Link>
                <span className="text-gray-500 text-xs ml-2">{w.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
