import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AssetCreateForm } from '@/components/AssetRegister/AssetCreateForm';

export default async function NewAssetPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const sites = await prisma.site.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  return (
    <div className="py-6">
      <AssetCreateForm sites={JSON.parse(JSON.stringify(sites))} />
    </div>
  );
}
