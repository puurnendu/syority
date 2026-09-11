import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import EventActionsClient from './EventActionsClient';
import EventMilestonesClient from './EventMilestonesClient';

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
      discipline: { select: { id: true, name: true, code: true } },
      calendar: { select: { id: true, name: true } },
      parentEvent: { select: { id: true, code: true, name: true } },
      childEvents: {
        where: { deleted_at: null },
        select: { id: true, code: true, name: true, status: true },
      },
      milestones: { orderBy: { sort_order: 'asc' } },
      eventUnits: {
        include: { unit: { select: { id: true, name: true, code: true } } },
      },
      _count: { select: { Workpack: true, wbsNodes: true } },
    },
  });
  if (!event) notFound();

  const workpacks = await prisma.workpack.findMany({
    where: { event_id: eventId, deleted_at: null },
    select: { id: true, title: true, workpack_id_code: true, status: true },
    orderBy: { updated_at: 'desc' },
    take: 20,
  });

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
          href={`/events/${eventId}/management-intelligence`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-700 text-white text-sm font-semibold rounded-lg hover:bg-violet-800"
        >
          Management intelligence
        </Link>
        <Link
          href={`/events/${eventId}/control-tower`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900"
        >
          Control Tower
        </Link>
        <Link
          href={`/events/${eventId}/ta-dashboard`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
        >
          📊 TA Dashboard
        </Link>
        <Link
          href={`/events/${eventId}/execution-readiness`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
        >
          🚀 Execution Readiness
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
        <EventActionsClient eventId={eventId} currentStatus={event.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Site</dt>
            <dd>{event.site?.name ?? '—'}</dd>
            <dt className="text-gray-500">Discipline</dt>
            <dd>{event.discipline ? `${event.discipline.code ?? ''} ${event.discipline.name}`.trim() : '—'}</dd>
            <dt className="text-gray-500">Calendar</dt>
            <dd>{event.calendar?.name ?? '—'}</dd>
            <dt className="text-gray-500">Parent event</dt>
            <dd>
              {event.parentEvent ? (
                <Link href={`/events/${event.parentEvent.id}`} className="text-blue-600 hover:underline">
                  {event.parentEvent.code}
                </Link>
              ) : (
                '—'
              )}
            </dd>
            <dt className="text-gray-500">Child shutdowns</dt>
            <dd>{event.childEvents.length}</dd>
            <dt className="text-gray-500">WBS nodes</dt>
            <dd>{event._count.wbsNodes}</dd>
            <dt className="text-gray-500">Planned start</dt>
            <dd>{event.planned_start ? new Date(event.planned_start).toLocaleDateString() : '—'}</dd>
            <dt className="text-gray-500">Planned end</dt>
            <dd>{event.planned_end ? new Date(event.planned_end).toLocaleDateString() : '—'}</dd>
            <dt className="text-gray-500">Workpacks</dt>
            <dd>{event._count.Workpack}</dd>
          </dl>
          {event.description ? (
            <p className="mt-4 text-sm text-gray-600 border-t border-gray-100 pt-3">{event.description}</p>
          ) : null}
          {event.childEvents.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
              {event.childEvents.map((c) => (
                <li key={c.id} className="text-sm">
                  <Link href={`/events/${c.id}`} className="text-blue-600 hover:underline">
                    {c.code} — {c.name}
                  </Link>
                  <span className="ml-2 text-xs text-gray-500">{c.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
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

      <EventMilestonesClient
        eventId={eventId}
        initial={event.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          code: m.code,
          milestone_type: m.milestone_type,
          planned_date: m.planned_date ? m.planned_date.toISOString() : null,
          status: m.status,
        }))}
      />

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
