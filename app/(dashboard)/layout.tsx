import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import NavBar from '@/components/NavBar';
import GlobalBreadcrumb from '@/components/GlobalBreadcrumb';
import { prisma } from '@/lib/prisma';
import { getEnabledFeatures } from '@/lib/features';
import { buildTenantShellNavigation } from '@/config/business-navigation';
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

    // ── OD9.2 §21 — NAVIGATION BY BUSINESS DOMAIN ───────────────────────────────
    // The tenant top level is FROZEN to exactly four business domains:
    //   1. DIGITAL PLANT · 2. STO · 3. PROJECT · 4. ORGANIZATION & ADMINISTRATION
    // AI/M16 is a cross-domain interaction layer, never a top-level business domain.
    //
    // The structure and every permission / feature-flag gate live in
    // src/config/business-navigation.ts so that the frozen domain boundaries can be
    // verified behaviourally instead of by grepping this layout (§25). Safety and Permit
    // Management appear only under STO (§22), and STO reporting is owned by STO rather
    // than a domain-neutral global Reports menu (§9).
    const showAdmin = hasPermission(role, 'settings.view') || isProxy;

    const navContext = {
        role,
        isFeat,
        isContractorTenant,
        showAdmin,
        canViewOrgSettings: hasPermission(role, 'settings.org.view') || isProxy,
    };

    // Domain order and labels come from TENANT_SHELL_SECTIONS via buildTenantShellNavigation.
    const tenantShellSections = buildTenantShellNavigation(navContext);
    const itemsFor = (id: string) => tenantShellSections.find((s) => s.id === id)?.items ?? [];
    const digitalPlantItems = itemsFor('digital-plant');
    const stoItems = itemsFor('sto');
    const projectItems = itemsFor('project');
    const adminItems = itemsFor('organization');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header
                className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="h-14 flex items-center">
                    <NavBar
                        tenantShellSections={tenantShellSections}
                        digitalPlantItems={digitalPlantItems}
                        stoItems={stoItems}
                        projectItems={projectItems}
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
