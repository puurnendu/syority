import Link from 'next/link';
import { requirePlatformContext } from '@/lib/server-context';

import { hasPermission } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function NewTenantPage() {
    const session = await requirePlatformContext();
    const role = session.role ?? '';
    if (!hasPermission(role, 'nav.admin')) redirect('/platform/tenants');

    return (
        <div className="space-y-6 p-8">
            <div>
                <Link href="/platform/tenants" className="text-sm text-gray-500 hover:text-gray-700">← Tenants</Link>
                <h1 className="text-xl font-bold text-gray-900 mt-2">New Tenant</h1>
                <p className="text-sm text-gray-500 mt-1">Create a new organisation on the platform.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-sm text-amber-800">Use the tenant list to manage existing organisations.</p>
                <Link href="/platform/tenants" className="inline-block mt-4 px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg">Back to Tenants</Link>
            </div>
        </div>
    );
}
