import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { NewSystemForm } from '@/components/system/NewSystemForm';

export default async function NewSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ unit_id?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  if (!hasPermission((session.user as any)?.role ?? (session.user as any)?.roles?.[0], 'system:create')) redirect('/planning/systems');

  const { unit_id: preselectedUnitId } = await searchParams;

  const [sites, units] = await Promise.all([
    prisma.site.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true },
    }),
    prisma.unit.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true, site_id: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
      <div className="mb-6">
        <Link
          href={preselectedUnitId ? `/planning/units/${preselectedUnitId}` : '/planning/systems'}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {preselectedUnitId ? 'Planning > Units' : 'Planning > Systems'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New System</h1>
      </div>
      <NewSystemForm sites={sites} units={units} preselectedUnitId={preselectedUnitId ?? undefined} />
    </div>
  );
}
