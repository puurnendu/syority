import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { PlantsSection } from './PlantsSection';

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  if (!hasPermission((session.user as { role?: string })?.role, 'settings.view'))
    redirect('/settings');

  const { siteId } = await params;

  const site = await prisma.site.findFirst({
    where: { id: siteId, organization_id: orgId },
    select: { id: true, name: true, code: true, location: true, timezone: true, is_active: true },
  });

  if (!site) notFound();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/settings/hierarchy/sites"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Sites
        </Link>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{site.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {site.code && (
                  <span className="font-mono text-gray-600">{site.code}</span>
                )}
                {site.location && ` · ${site.location}`}
                {site.timezone && ` · ${site.timezone}`}
              </p>
              {site.is_active === false && (
                <span className="inline-block mt-1 text-xs font-semibold text-red-600 uppercase tracking-wider">
                  Inactive
                </span>
              )}
            </div>
            <Link
              href={`/settings/sites/${siteId}/standards`}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Engineering standards
            </Link>
          </div>
        </div>
      </div>

      <PlantsSection siteId={site.id} />
    </div>
  );
}
