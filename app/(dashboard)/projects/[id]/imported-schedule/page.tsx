import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isLegacyProjectChainEnabled } from '@/lib/legacyProjectChain';
import ImportedScheduleClient from './ImportedScheduleClient';

/**
 * Phase 0 item 5 — legacy Project imported-schedule ("Baseline Schedule"),
 * quarantined behind the LEGACY_PROJECT_CHAIN feature flag (default off).
 * Its API is already fail-closed (OD9-049): the backing ScheduleImportBatch
 * model does not exist and M11-R0 retired schedule import. P6/MS Project/Excel
 * interchange lives at /integrations/import and /integrations/export.
 */
export default async function ImportedSchedulePage({
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
  return <ImportedScheduleClient projectId={id} />;
}
