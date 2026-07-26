import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';
import Link from 'next/link';

export default async function TADashboardPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    include: {
      site: { select: { id: true, name: true, code: true } },
    },
  });
  if (!event) notFound();

  // Aggregate workpack metrics
  const workpacks = await prisma.workpack.findMany({
    where: { event_id: eventId, deleted_at: null },
    select: { status: true, created_at: true, updated_at: true }
  });

  // Calculate some simple metrics
  const totalWP = workpacks.length;
  const closedWP = workpacks.filter(w => w.status.toLowerCase() === 'closed').length;
  const executionWP = workpacks.filter(w => w.status.toLowerCase() === 'execution').length;
  const percentComplete = totalWP === 0 ? 0 : Math.round((closedWP / totalWP) * 100);

  const metrics = {
    totalWP,
    closedWP,
    executionWP,
    percentComplete
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 h-full flex flex-col">
      <div className="mb-6 flex flex-wrap items-center gap-4 shrink-0">
        <Link href={`/events/${eventId}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Event
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          TA Dashboard: {event.code}
        </h1>
      </div>

      <div className="flex-1 min-h-0">
        <DashboardClient metrics={metrics} workpacks={workpacks} />
      </div>
    </div>
  );
}
