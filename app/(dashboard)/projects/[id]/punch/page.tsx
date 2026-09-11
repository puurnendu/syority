import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isLegacyProjectChainEnabled } from '@/lib/legacyProjectChain';

/**
 * Phase 0 item 5 — legacy Project punch placeholder, quarantined behind the
 * LEGACY_PROJECT_CHAIN feature flag (default off). Punch is STO execution
 * residue; the live register is Event/Workpack-scoped (`/punch`).
 */
export default async function ProjectPunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organization_id?: string } | null)?.organization_id;
  if (!(await isLegacyProjectChainEnabled(orgId))) {
    redirect(`/projects/${id}`);
  }
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Punch List</h1>
      <p className="text-sm text-gray-400">Phase 6 feature — coming soon</p>
    </div>
  );
}
