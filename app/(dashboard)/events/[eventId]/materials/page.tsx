import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { MaterialShortageClient } from './MaterialShortageClient';

export default async function EventMaterialsPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    const { eventId } = await params;
    const orgId = session.user.organization_id;
    if (!orgId) redirect('/login');

    const event = await prisma.event.findFirst({
        where: { id: eventId, organization_id: orgId },
        select: { id: true, name: true, start_date: true, end_date: true },
    });
    if (!event) redirect('/events');

    return <MaterialShortageClient eventId={eventId} eventName={event.name} />;
}
