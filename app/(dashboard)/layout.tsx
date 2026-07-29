import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import NavBar from '@/components/NavBar';
import GlobalBreadcrumb from '@/components/GlobalBreadcrumb';
import { prisma } from '@/lib/prisma';
import { getEnabledFeatures } from '@/lib/features';
import { cookies } from 'next/headers';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    if ((session.user as { must_change_password?: boolean }).must_change_password === true) {
        redirect('/auth/change-password');
    }

    const user = session.user as { id: string; name?: string | null; email?: string | null; organization_name?: string; organization_id: string };
    const orgName = user?.organization_name ?? 'Tenant';
    const rawRole = (user as { role?: string; roles?: string[] })?.role ?? (user as { role?: string; roles?: string[] })?.roles?.[0] ?? '';
    const role = String(rawRole).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    
    const orgId = user.organization_id;
    const roles = (user as any).roles ?? [];
    const isPlatformAdmin = roles.includes('platform_super_admin') || roles.includes('platform_admin');

    // Detect proxy mode via cookie
    const cookieStore = await cookies();
    const isProxy = isPlatformAdmin && !!cookieStore.get('syority_proxy')?.value;

    // Fetch enabled features for this tenant
    const enabledFeatures = await getEnabledFeatures(orgId);
    // For legacy/un-seeded installations, treat everything as enabled if the table is likely empty
    // But once seeded, we follow the flags strictly.
    const isFeat = (key: string) => enabledFeatures.length === 0 || enabledFeatures.includes(key);

    // Fetch tenant type
    const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { tenant_type: true }
    });
    const tenantType = (organization as any)?.tenant_type ?? 'refinery';
    const isContractorTenant = tenantType === 'contractor';

    const planningItems = [
        { href: '/planner-workspace', label: '🎯 Planner Workspace' },
        { href: '/events', label: 'Events / TAs' },
        { href: '/planning/templates', label: 'Workpack Templates' },
        { href: '/planning/units', label: 'Units' },
        { href: '/workpacks', label: 'Workpacks' },
        { href: '/projects', label: 'Projects' },
        { href: '/planning/systems', label: 'Systems' },
        { href: '/schedule', label: 'Execution Schedule' },
        { href: '/imported-schedule', label: 'Baseline Schedule' },
        { href: '/asset-register', label: 'Asset Register' },
        { href: '/digital-plant', label: '🏭 Digital Plant' },
        { href: '/engineering-issues', label: '🔧 Scope Intelligence' },
        { href: '/shutdown-scope', label: '📋 Shutdown Scope' },
        { href: '/workpack-intelligence', label: '⚡ Workpack Intelligence' },
    ].filter((item) => {
        // Feature flags
        if (item.href === '/asset-register' && !isFeat('ASSET_REGISTER')) return false;

        // Feature gating based on tenant type
        if (isContractorTenant) {
            if (['/planning/units', '/planning/systems', '/asset-register', '/workpacks'].includes(item.href)) return false;
        }

        if (item.href === '/planning/templates') {
            return hasPermission(role, 'settings.templates.view') || hasPermission(role, 'workpacks.create');
        }
        if (item.href === '/planning/units') return hasPermission(role, 'unit:view');
        if (item.href === '/planning/systems') return hasPermission(role, 'system:view');
        if (item.href === '/digital-plant') return hasPermission(role, 'asset.view');
        if (item.href === '/engineering-issues') return hasPermission(role, 'asset.view');
        if (item.href === '/schedule' || item.href === '/imported-schedule') return hasPermission(role, 'workpacks.view');
        return hasPermission(role, 'workpacks.view');
    });

    const executionItems = [
        { href: '/constraints', label: 'Constraints' },
        { href: '/punch', label: 'Punch List' },
        { href: '/permits', label: 'Permits / PTW' },
    ].filter(() => hasPermission(role, 'workpacks.view'));

    const intelligenceItems = [
        { href: '/reporting', label: 'Intelligence Dashboard' },
        { href: '/shift-reports', label: 'Shift Reports' },
        { href: '/whatsapp-reviews', label: 'WhatsApp Reviews' },
        { href: '/lessons', label: 'Lessons Learned' },
    ].filter((item) => {
        // Feature flags
        if (item.href === '/whatsapp-reviews' && !isFeat('WHATSAPP_REVIEWS')) return false;

        if (item.href === '/reporting') return hasPermission(role, 'reporting:view');
        if (item.href === '/shift-reports') return hasPermission(role, 'reporting:view');
        if (item.href === '/whatsapp-reviews') return hasPermission(role, 'reporting:view');
        return hasPermission(role, 'workpacks.view');
    });

    const importExportItems = [
        { href: '/integrations/export', label: 'Schedule Export' },
        { href: '/integrations/import', label: 'Schedule Import' },
        { href: '/integrations/export/history', label: 'Export History' },
    ].filter(() => hasPermission(role, 'workpacks.view'));

    const safetyItem = (hasPermission(role, 'workpacks.view') && isFeat('SAFETY_MODULE')) ? { href: '/safety', label: 'Safety' } : null;
    const documentItem = (hasPermission(role, 'workpacks.view') && isFeat('DOCUMENT_MANAGEMENT')) ? { href: '/documents', label: 'Documents' } : null;

    // Organization / Settings — tenant only (never platform-data / platform AI)
    const showAdmin = hasPermission(role, 'settings.view') || isProxy;
    const adminItems: { href: string; label: string }[] = [];

    if (showAdmin) {
        adminItems.push({ href: '/settings/organization', label: 'Organisation' });
        adminItems.push({ href: '/settings/users', label: 'Users' });
        adminItems.push({ href: '/settings', label: 'Settings' });
        if (hasPermission(role, 'settings.org.view') || isProxy) {
            adminItems.push({ href: '/settings/subscription', label: 'License & Subscription' });
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header
                className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="h-14 flex items-center">
                    <NavBar
                        planningItems={planningItems}
                        executionItems={executionItems}
                        intelligenceItems={intelligenceItems}
                        importExportItems={importExportItems}
                        safetyItem={safetyItem}
                        documentItem={documentItem}
                        adminItems={adminItems}
                        platformItems={[]}
                        tenantsItems={[]}
                        platformDataItems={[]}
                        showAdmin={showAdmin}
                        showPlatform={false}
                        showPlatformData={false}
                        isProxy={isProxy}
                        currentRole={role}
                        user={{ name: user?.name, email: user?.email }}
                        orgName={orgName}
                    />
                </div>
            </header>

            <GlobalBreadcrumb isProxy={isProxy} orgName={orgName} />

            {/* Body: flex so workpack detail can fill height */}
            <div className="flex flex-1 min-h-0 flex-col">
                {children}
            </div>
        </div>
    );
}
