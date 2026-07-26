import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CentralJointRegister } from '@/components/Registers/CentralJointRegister';

export default async function JointsPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    const user = session.user as any;
    const orgId = user.organization_id;

    // Fetch all joints for the organization directly in the server component
    const joints = await prisma.jointIntegrityItem.findMany({
        where: {
            organization_id: orgId,
            deleted_at: null,
        },
        include: {
            workpack: {
                select: {
                    id: true,
                    workpack_id_code: true,
                    title: true,
                },
            },
        },
        orderBy: { created_at: 'desc' },
    });

    return <CentralJointRegister initialItems={joints} />;
}
