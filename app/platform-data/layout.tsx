import { requireDataAdminContext } from '@/lib/server-context';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import GlobalBreadcrumb from '@/components/GlobalBreadcrumb';

export default async function PlatformDataLayout({ children }: { children: React.ReactNode }) {
    const session = await requireDataAdminContext();
    
    // Fetch limited user info for settings dropdown
    const dbUser = await prisma.user.findUnique({
        where: { id: session.user_id },
        select: { name: true, email: true }
    });
    
    const platformDataItems = [
        { href: '/platform-data/master-data/equipment-types', label: 'Equipment Types' },
        { href: '/platform-data/master-data/activity-codes', label: 'Activity Codes' },
        { href: '/platform-data/master-data/disciplines', label: 'Disciplines' },
        { href: '/platform-data/master-data/resources', label: 'Resources' },
        { href: '/platform-data/master-data/item-catalog', label: 'Item Catalog' },
        { href: '/platform-data/workpack-templates', label: 'Workpack Templates' },
        { href: '/platform-data/udf-definitions', label: 'UDF Definitions' },
        { href: '/platform-data/certificate-templates', label: 'Certificate Templates' },
        { href: '/platform-data/print-settings', label: 'Print Settings' },
    ];

    // Some items might be visible conditionally to platform admin if they wander here
    const isPlatformAdmin = session.role === 'platform_super_admin' || session.role === 'platform_admin';

    const platformItems = isPlatformAdmin ? [
        { href: '/platform/billing', label: 'Platform Billing' },
        { href: '/platform/users', label: 'Platform Users' },
        { href: '/platform/system', label: 'System Health' },
        { href: '/platform/features', label: 'Feature Flags' }
    ] : [];

    const tenantsItems = isPlatformAdmin ? [
        { href: '/platform/tenants', label: 'Manage Tenants' },
        { href: '/platform/onboarding', label: 'Onboarding Requests' }
    ] : [];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header
                className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="h-14 flex items-center">
                    <NavBar
                        planningItems={[]}
                        executionItems={[]}
                        intelligenceItems={[]}
                        importExportItems={[]}
                        safetyItem={null}
                        documentItem={null}
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
