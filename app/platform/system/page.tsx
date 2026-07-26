import { prisma } from '@/lib/prisma';
import { requirePlatformContext } from '@/lib/server-context';

import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { EmailConfigSection } from './EmailConfigSection';
import { BackfillToolSection } from './BackfillToolSection';

export default async function SystemPage() {
    const session = await requirePlatformContext();
    const role = session.role ?? '';
    if (!hasPermission(role, 'nav.admin')) redirect('/platform/tenants');

    const [orgCount, userCount, workpackCount] = await Promise.all([
        prisma.organization.count({ where: { deleted_at: null } }),
        prisma.user.count({ where: { deleted_at: null } }),
        prisma.workpack.count({ where: { deleted_at: null } }),
    ]);

    return (
        <div className="space-y-6 p-8">
            <div>
                <h1 className="text-xl font-bold text-gray-900">System Health</h1>
                <p className="text-sm text-gray-500 mt-1">Platform-wide statistics</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Organisations', value: orgCount, icon: '🏢', color: 'text-blue-600' },
                    { label: 'Total Users', value: userCount, icon: '👥', color: 'text-green-600' },
                    { label: 'Total Workpacks', value: workpackCount, icon: '📋', color: 'text-purple-600' },
                    { label: 'DB Status', value: 'Online', icon: '💚', color: 'text-green-600' },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="bg-white rounded-xl border border-gray-200 p-5 text-center"
                    >
                        <div className="text-2xl mb-2">{stat.icon}</div>
                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Health Check</h3>
                <a
                    href="/api/health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                >
                    GET /api/health →
                </a>
            </div>

            <EmailConfigSection />
            <BackfillToolSection />
        </div>
    );
}
