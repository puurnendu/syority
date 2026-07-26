import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';
import { SystemsListClient } from '@/components/system/SystemsListClient';

export default async function SystemsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  if (!hasPermission(role, 'system:view')) redirect('/dashboard');

  const [systems, events, sites, eventSystemsResult] = await Promise.all([
    prisma.system.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: {
        site: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, code: true } },
        _count: { select: { blinds: true, gaskets: true, workpacks: true } },
      },
      orderBy: [{ unit: { name: 'asc' } }, { code: 'asc' }],
    }),
    prisma.event.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true, status: true },
      orderBy: { planned_start: 'desc' },
      take: 50,
    }),
    prisma.site.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true },
    }),
    (async (): Promise<{ event_id: string; system_id: string }[]> => {
      try {
        return await prisma.eventSystem.findMany({
          where: { event: { organization_id: orgId } },
          select: { event_id: true, system_id: true },
        });
      } catch {
        return [];
      }
    })(),
  ]);

  const eventSystems = eventSystemsResult;

  const canCreate = hasPermission(role, 'system:create');
  const eventSystemMap = new Map<string, Set<string>>();
  for (const es of eventSystems) {
    if (!eventSystemMap.has(es.event_id)) eventSystemMap.set(es.event_id, new Set());
    eventSystemMap.get(es.event_id)!.add(es.system_id);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Systems</h1>
          <p className="text-sm text-gray-500 mt-0.5">Planning &gt; Systems</p>
        </div>
        {canCreate && (
          <Link
            href="/planning/systems/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New System
          </Link>
        )}
      </div>
      <SystemsListClient
        initialSystems={systems}
        events={events}
        sites={sites}
        eventSystemMap={Object.fromEntries([...eventSystemMap.entries()].map(([k, v]) => [k, [...v]]))}
        canCreate={canCreate}
      />
    </div>
  );
}
