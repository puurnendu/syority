import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import ExecutionReadinessClient from './ExecutionReadinessClient';

export default async function ExecutionReadinessPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true, status: true, event_type: true },
  });
  if (!event) notFound();

  const workpacks = await prisma.workpack.findMany({
    where: { event_id: eventId, deleted_at: null },
    select: {
      id: true,
      title: true,
      workpack_id_code: true,
      status: true,
      _count: { select: { Activity: { where: { deleted_at: null } } } }
    },
    orderBy: { updated_at: 'desc' },
  });

  // Check snapshots
  const wpIds = workpacks.map(w => w.id);
  const snapshots = await prisma.workpackAssetSnapshot.findMany({
    where: { workpack_id: { in: wpIds }, organization_id: orgId },
    select: { workpack_id: true }
  });
  const snapshotSet = new Set(snapshots.map(s => s.workpack_id));

  // Determine readiness
  const data = workpacks.map(wp => {
      const hasSnapshot = snapshotSet.has(wp.id);
      const isApproved = wp.status === 'approved';
      const isEligible = isApproved && hasSnapshot && wp._count.Activity > 0;
      return {
          id: wp.id,
          title: wp.title,
          code: wp.workpack_id_code,
          status: wp.status,
          activities: wp._count.Activity,
          hasSnapshot,
          isEligible,
      };
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/events/${eventId}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Event
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Execution Readiness: {event.code}
        </h1>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
         <h2 className="text-lg font-semibold mb-4">Workpacks in Scope</h2>
         <p className="text-sm text-gray-500 mb-6">Review workpacks attached to this event. Only Approved workpacks with snapshots and activities can be issued to the field.</p>
         <ExecutionReadinessClient workpacks={data} />
      </div>
    </div>
  );
}
