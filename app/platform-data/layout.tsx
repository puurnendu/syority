import { requireDataAdminContext } from '@/lib/server-context';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import GlobalBreadcrumb from '@/components/GlobalBreadcrumb';
import {
    buildPlatformDropdownItems,
    buildPlatformDataItems,
    buildTenantsItems,
} from '@/config/platform-navigation';

export default async function PlatformDataLayout({ children }: { children: React.ReactNode }) {
    const session = await requireDataAdminContext();
    
    // Fetch limited user info for settings dropdown
    const dbUser = await prisma.user.findUnique({
        where: { id: session.user_id },
        select: { name: true, email: true }
    });

    const isPlatformAdmin = session.role === 'platform_super_admin' || session.role === 'platform_admin';
    const role = session.role ?? '';

    const platformDataItems = buildPlatformDataItems();
    const platformItems = isPlatformAdmin ? buildPlatformDropdownItems(role) : [];
    const tenantsItems = isPlatformAdmin ? buildTenantsItems(role) : [];

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
                        showPlatform={isPlatformAdmin}
                        showPlatformData={true}
                        showNotifications={false}
                        isProxy={false}
                        currentRole={isPlatformAdmin ? 'platform_admin' : 'data_admin'}
                        user={{ name: dbUser?.name, email: dbUser?.email }}
                        orgName="SYORITY MASTER DATA"
                        homeLinkHref="/platform-data"
                        homeLinkLabel="Master Data Home"
                    />
                </div>
            </header>

            <GlobalBreadcrumb isProxy={false} orgName="Master Data" />

            <div className="flex flex-1 min-h-0 flex-col">
                {children}
            </div>
        </div>
    );
}
