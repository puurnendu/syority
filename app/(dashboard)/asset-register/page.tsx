import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import RegisterTreeClient from './RegisterTreeClient';

export default async function AssetRegisterPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');

  const sites = await prisma.site.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  const plants = await prisma.plant.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: {
      id: true,
      name: true,
      code: true,
      site_id: true,
      units: {
        where: { deleted_at: null },
        select: {
          id: true,
          name: true,
          code: true,
          systems: {
            where: { deleted_at: null },
            select: {
              id: true,
              name: true,
              code: true,
              assets: {
                where: { deleted_at: null },
                select: { id: true, tag_number: true, name: true, asset_type: true },
              },
            },
          },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
      <aside className="w-72 flex-shrink-0 bg-white rounded-lg border border-gray-200 p-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Hierarchy</h2>
        <p className="text-xs text-gray-500 mb-3">Select a site to browse plants, units, systems and assets.</p>
        <RegisterTreeClient initialSites={sites} initialPlants={plants} />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Asset Register</h1>
          <div className="flex gap-2">
            <Link
              href="/asset-register/import"
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
            >
              Import Excel
            </Link>
            <Link
              href="/asset-register/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              + Add Asset
            </Link>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Select an asset from the hierarchy tree to view details, or use the buttons above to add or import assets.
        </div>
      </main>
    </div>
  );
}
