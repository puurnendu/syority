import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { UnitsListClient } from '@/components/unit/UnitsListClient';

export default async function UnitsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  if (!hasPermission(role, 'unit:view')) redirect('/dashboard');

  const [events, sites, plants] = await Promise.all([
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
    prisma.plant.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const canManage = hasPermission(role, 'unit:manage');

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Units</h1>
          <p className="text-sm text-gray-500 mt-0.5">Planning &gt; Units</p>
        </div>
      </div>
      <UnitsListClient events={events} sites={sites} plants={plants} canCreate={canManage} />
    </div>
  );
}
