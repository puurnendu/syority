import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function EventsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');

  const events = await prisma.event.findMany({
    where: { organization_id: orgId, deleted_at: null },
    include: {
      site: { select: { id: true, name: true, code: true } },
      _count: { select: { Workpack: true, eventUnits: true } },
    },
    orderBy: [{ planned_start: 'desc' }, { created_at: 'desc' }],
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events / TAs</h1>
        <Link href="/events/new" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
          + New Event
        </Link>
      </div>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workpacks</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No events yet.</td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link href={`/events/${ev.id}`} className="text-blue-600 hover:underline">{ev.code}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{ev.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ev.event_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ev.site?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ev.status}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ev._count.Workpack}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
