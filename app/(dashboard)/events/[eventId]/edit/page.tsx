import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import EventEditClient from './EventEditClient';

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
  });
  if (!event) notFound();

  const [sites, calendars, disciplines, parentEvents] = await Promise.all([
    prisma.site.findMany({
      where: { organization_id: orgId },
      select: { id: true, name: true },
    }),
    prisma.scheduleCalendar.findMany({
      where: { organization_id: orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.discipline.findMany({
      where: { organization_id: orgId },
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    }),
    prisma.event.findMany({
      where: { organization_id: orgId, deleted_at: null, id: { not: eventId } },
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    }),
  ]);

  return (
    <EventEditClient
      event={event}
      sites={sites}
      calendars={calendars}
      disciplines={disciplines}
      parentEvents={parentEvents}
    />
  );
}
