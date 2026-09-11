import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AssetDetailClient from './AssetDetailClient';

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const { assetId } = await params;

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organization_id: orgId, deleted_at: null },
    include: {
      Site: { select: { id: true, name: true } },
      system: { include: { unit: { select: { name: true, code: true } } } },
      nozzles: { where: { deleted_at: null }, orderBy: { sequence_number: 'asc' } },
      _count: { select: { joint_masters: true } },
    },
  });
  if (!asset) notFound();

  const workpackHistory = await prisma.workpack.findMany({
    where: { asset_id: assetId, deleted_at: null },
    select: { id: true, title: true, workpack_id_code: true, status: true, updated_at: true },
    orderBy: { updated_at: 'desc' },
    take: 5,
  });

  const lines = await prisma.line_lists.findMany({
    where: { 
      organization_id: orgId, 
      OR: [
        { from_asset_id: assetId },
        { to_asset_id: assetId }
      ]
    },
    include: {
      from_nozzle: true,
      to_nozzle: true,
    }
  });

  const joints = await prisma.joint_masters.findMany({
    where: { 
      organization_id: orgId, 
      asset_id: assetId
    },
    include: {
      nozzle: true,
      line: true
    }
  });

  let drawings: any[] = [];
  let procedures: any[] = [];
  
  if (asset.system_id) {
    drawings = await prisma.system_drawings.findMany({
      where: { system_id: asset.system_id }
    });
    procedures = await prisma.system_procedures.findMany({
      where: { system_id: asset.system_id }
    });
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 h-full flex flex-col">
      <div className="mb-4 flex items-center gap-4 shrink-0">
        <Link href="/asset-register" className="text-gray-500 hover:text-gray-700 text-sm">← Asset Register</Link>
        <h1 className="text-2xl font-bold text-gray-900">{asset.tag_number} — {asset.name}</h1>
        {asset.asset_type && <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">{asset.asset_type}</span>}
        {/* M8.14-R1: Equipment lifecycle status badge */}
        {asset.status && (
          <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider ${
            asset.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
            asset.status === 'draft' ? 'bg-amber-100 text-amber-800' :
            'bg-gray-100 text-gray-500'
          }`}>{asset.status}</span>
        )}
        {/* M8.14-R1: Criticality badge */}
        {asset.criticality && (
          <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider ${
            asset.criticality === 'critical' ? 'bg-red-100 text-red-800' :
            asset.criticality === 'high' ? 'bg-orange-100 text-orange-800' :
            asset.criticality === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>{asset.criticality}</span>
        )}
        {/* M8.15: Equipment 360 navigation */}
        <Link
          href={`/asset-register/${assetId}/360`}
          className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          🔄 Equipment 360
        </Link>
      </div>
      
      <div className="flex-1 min-h-0">
        <AssetDetailClient asset={asset} lines={lines} joints={joints} drawings={drawings} procedures={procedures} />
      </div>
    </div>
  );
}
