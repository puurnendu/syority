import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { PortfolioDashboard } from '@/components/Dashboard/PortfolioDashboard';

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    const user = session.user as any;
    const role = user?.role ?? user?.roles?.[0] ?? '';
    const orgId = user.organization_id;

    // Fetch summary counts for dashboard cards
    const [workpackCount, activityCount, constraintCount, punchCount] = await Promise.all([
        prisma.workpack.count({ where: { organization_id: orgId, deleted_at: null } }),
        prisma.activity.count({ where: { organization_id: orgId, deleted_at: null } }),
        prisma.constraint.count({ where: { organization_id: orgId, deleted_at: null } }),
        prisma.punchListItem.count({ where: { organization_id: orgId, deleted_at: null } }),
    ]);

    const cards = [
        { title: 'Workpacks', count: workpackCount, icon: '📋', href: '/workpacks', color: 'blue', desc: 'Active work packages' },
        { title: 'Activities', count: activityCount, icon: '📝', href: '/schedule', color: 'emerald', desc: 'Scheduled activities' },
        { title: 'Constraints', count: constraintCount, icon: '⚠️', href: '/constraints', color: 'amber', desc: 'Open constraints' },
        { title: 'Punch Items', count: punchCount, icon: '🔴', href: '/punch', color: 'red', desc: 'Punch list items' },
    ];

    const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'bg-blue-100' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'bg-emerald-100' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'bg-amber-100' },
        red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'bg-red-100' },
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">Organisation portfolio overview</p>
            </div>

            {/* Portfolio dashboard (client component) */}
            <PortfolioDashboard />

            {/* Existing summary cards and quick actions */}
            <div className="space-y-8">
                <p className="text-sm text-gray-500">Welcome back, {user.name ?? user.email}. Here&apos;s your operations overview.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {cards.map((card) => {
                    const c = colorMap[card.color] ?? colorMap.blue;
                    return (
                        <Link
                            key={card.title}
                            href={card.href}
                            className={`group relative ${c.bg} ${c.border} border rounded-2xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{card.title}</p>
                                    <p className={`text-3xl font-bold mt-1 ${c.text}`}>{card.count}</p>
                                    <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
                                </div>
                                <div className={`${c.icon} rounded-xl p-2.5 text-xl`}>{card.icon}</div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <Link href="/workpacks/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                        <span>+</span> New Workpack
                    </Link>
                    <Link href="/workpacks" className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                        📋 View All Workpacks
                    </Link>
                    {hasPermission(role, 'nav.admin') && (
                        <Link href="/admin/tenants" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c] transition-colors">
                            ⚡ Admin Panel
                        </Link>
                    )}
                    <Link href="/admin/setup" className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                        ⚙️ Admin Setup
                    </Link>
                </div>
            </div>
            </div>
        </div>
    );
}
