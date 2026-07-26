import { requirePlatformContext } from '@/lib/server-context';
import { prisma } from '@/lib/prisma';
import { TenantListClient } from './TenantListClient';

export default async function TenantsPage() {
    await requirePlatformContext();

    const orgs = await prisma.organization.findMany({
        where: { deleted_at: null },
        include: {
            _count: {
                select: {
                    User: { where: { deleted_at: null } },
                    Site: true,
                    Workpack: { where: { deleted_at: null } },
                },
            },
        },
        orderBy: { name: 'asc' },
    });

    // Normalize Prisma relation names to the shape the client already expects.
    const normalized = orgs.map((o) => ({
        ...o,
        _count: {
            users: o._count.User,
            sites: o._count.Site,
            workpacks: o._count.Workpack,
        },
    }));

    return (
        <div className="p-8">
            <TenantListClient orgs={normalized} />
        </div>
    );
}
