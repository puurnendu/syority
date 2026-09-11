import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ControlTowerDashboard } from '@/components/m13/ControlTowerDashboard';

export default async function EventControlTowerPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true, code: true, name: true },
  });
  if (!event) notFound();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href={`/events/${eventId}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Event
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Control Tower: {event.code}
        </h1>
      </div>
      <ControlTowerDashboard eventId={eventId} />
    </div>
  );
}
