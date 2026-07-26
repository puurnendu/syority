import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { SystemTabs } from '@/components/system/SystemTabs';

export default async function SystemDetailPage({ params }: { params: Promise<{ systemId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  if (!hasPermission(role, 'system:view')) redirect('/dashboard');

  const { systemId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    include: {
      site: { select: { id: true, name: true, code: true } },
      unit: { select: { id: true, name: true, code: true } },
      _count: { select: { blinds: true, gaskets: true, drawings: true, procedures: true, workpacks: true, line_lists: true, assets: true } },
    },
  });

  if (!system) notFound();

  const canEdit = hasPermission(role, 'system:edit');
  const sys = JSON.parse(JSON.stringify(system, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <SystemTabs system={sys} canEdit={canEdit} />
    </div>
  );
}
