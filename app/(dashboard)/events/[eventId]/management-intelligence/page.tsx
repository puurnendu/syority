import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ManagementIntelligencePanel } from '@/components/m15/ManagementIntelligencePanel';

export default async function ManagementIntelligencePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
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
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={`/events/${eventId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {event.code}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Management intelligence</h1>
      </div>
      <p className="mb-6 text-sm text-gray-600 max-w-3xl">
        M13 Control Tower answers what is happening. This page answers why it matters and what
        management should consider. Recommendations are advisory. Execution remains M16 confirmation
        then M12 EWS.
      </p>
      <ManagementIntelligencePanel eventId={eventId} />
    </div>
  );
}
