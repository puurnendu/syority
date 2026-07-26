import Link from 'next/link';
import { requirePlatformContext } from '@/lib/server-context';
import { prisma } from '@/lib/prisma';

export default async function PlatformDashboardPage() {
    await requirePlatformContext();

    const [
        totalTenants,
        activeTenants,
        totalUsers,
        activeUsers,
        totalWorkpacks,
        orgsForLicense,
    ] = await Promise.all([
        prisma.organization.count({
            where: { deleted_at: null, NOT: { tenant_type: 'platform' } },
        }),
        prisma.organization.count({
            where: {
                deleted_at: null,
                NOT: { tenant_type: 'platform' },
                OR: [{ is_active: true }, { status: 'active' }],
            },
        }),
        prisma.user.count({ where: { deleted_at: null } }),
        prisma.user.count({ where: { deleted_at: null, is_active: true } }),
        prisma.workpack.count({ where: { deleted_at: null } }),
        prisma.organization.findMany({
            where: { deleted_at: null, NOT: { tenant_type: 'platform' } },
            select: {
                plan_tier: true,
                payment_status: true,
                max_users: true,
                contract_end_date: true,
            },
        }),
    ]);

    const tierCounts: Record<string, number> = {};
    let licensedSeats = 0;
    let pastDue = 0;
    let expiringSoon = 0;
    const now = Date.now();
    const in30d = now + 30 * 24 * 60 * 60 * 1000;

    for (const org of orgsForLicense) {
        const tier = (org.plan_tier || 'professional').toLowerCase();
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        licensedSeats += org.max_users ?? 0;
        if (org.payment_status === 'past_due') pastDue += 1;
        if (org.contract_end_date) {
            const end = new Date(org.contract_end_date).getTime();
            if (end >= now && end <= in30d) expiringSoon += 1;
        }
    }

    const cards = [
        {
            label: 'Tenants',
            value: totalTenants,
            subtitle: `${activeTenants} active`,
            href: '/platform/tenants',
            icon: '🏢',
            accent: 'border-blue-200 bg-blue-50/60',
        },
        {
            label: 'Users',
            value: totalUsers,
            subtitle: `${activeUsers} active`,
            href: '/platform/users',
            icon: '👥',
            accent: 'border-emerald-200 bg-emerald-50/60',
        },
        {
            label: 'Workpacks',
            value: totalWorkpacks,
            subtitle: 'Across all tenants',
            href: '/platform/tenants',
            icon: '📋',
            accent: 'border-violet-200 bg-violet-50/60',
        },
        {
            label: 'Licensed seats',
            value: licensedSeats,
            subtitle: pastDue > 0 ? `${pastDue} past due` : `${expiringSoon} expiring in 30d`,
            href: '/platform/billing',
            icon: '💳',
            accent: 'border-amber-200 bg-amber-50/60',
        },
    ];

    const tierEntries = Object.entries(tierCounts).sort((a, b) => b[1] - a[1]);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Platform Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Cross-tenant summary of tenants, users, workpacks, and licensing.
                    </p>
                </div>
                <Link
                    href="/platform/tenants"
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg bg-[#0D2137] text-white hover:bg-[#1a3a5c]"
                >
                    Manage Tenants
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <Link
                        key={card.label}
                        href={card.href}
                        className={`rounded-2xl border p-5 transition-shadow hover:shadow-md ${card.accent}`}
                    >
                        <div className="flex items-start justify-between">
                            <span className="text-2xl" aria-hidden>
                                {card.icon}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Summary
                            </span>
                        </div>
                        <div className="mt-4 text-3xl font-black text-gray-900 tabular-nums">{card.value}</div>
                        <div className="mt-1 text-sm font-semibold text-gray-800">{card.label}</div>
                        <div className="mt-0.5 text-xs text-gray-500">{card.subtitle}</div>
                    </Link>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h2 className="text-base font-bold text-gray-900 mb-4">License tiers</h2>
                    {tierEntries.length === 0 ? (
                        <p className="text-sm text-gray-400">No customer tenants yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {tierEntries.map(([tier, count]) => (
                                <li key={tier} className="flex items-center justify-between text-sm">
                                    <span className="capitalize font-medium text-gray-700">{tier}</span>
                                    <span className="font-bold text-gray-900 tabular-nums">{count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Link href="/platform/billing" className="inline-block mt-5 text-sm text-blue-600 hover:underline">
                        Open Licensing & Billing →
                    </Link>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h2 className="text-base font-bold text-gray-900 mb-4">Quick links</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { href: '/platform/users', label: 'Platform Users' },
                            { href: '/platform/features', label: 'Feature Flags' },
                            { href: '/platform/system', label: 'SMTP & System' },
                            { href: '/platform-data', label: 'Master Data Hub' },
                            { href: '/platform/setup', label: 'Setup / Health' },
                            { href: '/platform/ai-config', label: 'AI Providers' },
                        ].map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
