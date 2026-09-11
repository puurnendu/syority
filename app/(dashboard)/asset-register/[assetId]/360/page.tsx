/**
 * M8.15 — Equipment 360 V1 Server Page
 *
 * Route: /asset-register/[assetId]/360
 *
 * Server component that validates session + asset ownership,
 * then renders the Equipment360Client.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Equipment360Client from './Equipment360Client';

export default async function Equipment360Page({ params }: { params: Promise<{ assetId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const { assetId } = await params;

  // Verify asset belongs to authenticated tenant
  // NOTE: Uses only fields available in the runtime Prisma client.
  // M8.14-R1 fields (status, criticality, data_source) are in schema but may not be
  // migrated in all environments — we read them from the 360 API instead.
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organization_id: orgId, deleted_at: null },
    select: {
      id: true,
      tag_number: true,
      name: true,
      asset_type: true,
    },
  });
  if (!asset) notFound();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 h-full flex flex-col">
      {/* Breadcrumb + Header */}
      <div className="mb-4 flex items-center gap-3 shrink-0 flex-wrap">
        <Link href="/asset-register" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Asset Register
        </Link>
        <span className="text-gray-300">|</span>
        <Link href={`/asset-register/${assetId}`} className="text-gray-500 hover:text-gray-700 text-sm">
          {asset.tag_number}
        </Link>
        <span className="text-gray-300">→</span>
        <h1 className="text-xl font-bold text-gray-900">Equipment 360</h1>
        <span className="text-lg font-semibold text-gray-700">{asset.tag_number} — {asset.name}</span>
        {asset.asset_type && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">{asset.asset_type}</span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <Equipment360Client assetId={assetId} assetTag={asset.tag_number} />
      </div>
    </div>
  );
}
