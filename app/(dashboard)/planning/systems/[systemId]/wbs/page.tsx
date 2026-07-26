import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { WbsManagerClient } from '@/components/system/wbs/WbsManagerClient';

export default async function SystemWbsPage({ params }: { params: Promise<{ systemId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  if (!hasPermission(role, 'system:view')) redirect('/dashboard');
  const canManage = hasPermission(role, 'system:wbs:manage');
  const canGenerate = hasPermission(role, 'system:wbs:generate');

  const { systemId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    include: { unit: { select: { name: true, code: true } }, site: { select: { name: true } } },
  });
  if (!system) notFound();

  const events = await prisma.event.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, name: true, code: true },
    orderBy: { planned_start: 'desc' },
    take: 30,
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          <Link href="/planning/systems" className="hover:text-gray-700">Planning</Link>
          {' > '}
          <Link href="/planning/systems" className="hover:text-gray-700">Systems</Link>
          {' > '}
          <Link href={`/planning/systems/${systemId}`} className="hover:text-gray-700">{system.name}</Link>
          {' > WBS'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">WBS Manager</h1>
        <p className="text-sm text-gray-500 mt-0.5">{system.code ?? system.id} · {system.unit?.name ?? '—'}</p>
      </div>
      <WbsManagerClient
        systemId={systemId}
        systemName={system.name}
        events={events}
        canManage={canManage}
        canGenerate={canGenerate}
      />
    </div>
  );
}
