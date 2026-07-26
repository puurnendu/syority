import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { NewUnitForm } from '@/components/unit/NewUnitForm';

export default async function NewUnitPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  if (!hasPermission(role, 'unit:manage')) redirect('/planning/units');

  const [sites, plants] = await Promise.all([
    prisma.site.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true },
    }),
    prisma.plant.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true, site_id: true },
    }),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <Link href="/planning/units" className="text-sm text-gray-500 hover:text-gray-700">
          ← Planning &gt; Units
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New Unit</h1>
      </div>
      <NewUnitForm sites={sites} plants={plants} />
    </div>
  );
}
