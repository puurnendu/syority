import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isLegacyProjectChainEnabled } from '@/lib/legacyProjectChain';
import DailyReportClient from './DailyReportClient';

/**
 * Phase 0 item 5 — legacy Project AI daily report, quarantined behind the
 * LEGACY_PROJECT_CHAIN feature flag (default off). The current Project report
 * surface is /projects/[id]/reports/status (Project-domain authority); STO
 * daily/shift reporting is /shift-reports (M14, Event-scoped).
 */
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organization_id?: string } | null)?.organization_id;
  if (!(await isLegacyProjectChainEnabled(orgId))) {
    redirect(`/projects/${id}/reports/status`);
  }
  return <DailyReportClient />;
}
