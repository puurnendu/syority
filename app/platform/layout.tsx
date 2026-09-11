import { requirePlatformContext } from '@/lib/server-context';
import NavBar from '@/components/NavBar';
import GlobalBreadcrumb from '@/components/GlobalBreadcrumb';
import { prisma } from '@/lib/prisma';
import {
    buildPlatformDropdownItems,
    buildPlatformDataItems,
    buildTenantsItems,
} from '@/config/platform-navigation';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
    const session = await requirePlatformContext();

    const dbUser = await prisma.user.findUnique({
        where: { id: session.user_id },
        select: { name: true, email: true },
    });

    const role = session.role ?? '';
    const tenantsItems = buildTenantsItems(role);
    const platformItems = buildPlatformDropdownItems(role);
    const platformDataItems = buildPlatformDataItems();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header
                className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="h-14 flex items-center">
                    <NavBar
                        adminItems={[]}
                        platformItems={platformItems}
                        tenantsItems={tenantsItems}
                        platformDataItems={platformDataItems}
                        showAdmin={false}
                        showPlatform={true}
                        showPlatformData={true}
                        showNotifications={false}
                        isProxy={false}
                        currentRole="platform_admin"
                        user={{ name: dbUser?.name, email: dbUser?.email }}
                        orgName="SYORITY PLATFORM"
                        homeLinkHref="/platform/dashboard"
                        homeLinkLabel="Dashboard"
                    />
                </div>
            </header>

            <GlobalBreadcrumb />

            <div className="flex flex-1 min-h-0 flex-col">{children}</div>
        </div>
    );
}
