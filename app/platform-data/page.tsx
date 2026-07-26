import { requireDataAdminContext } from '@/lib/server-context';
import Link from 'next/link';

const SECTIONS = [
    {
        title: 'Master Data',
        description: 'Standardized reference data shared across all tenants',
        color: 'blue',
        items: [
            { href: '/platform-data/master-data/equipment-types', label: 'Equipment Types', icon: '⚙️' },
            { href: '/platform-data/master-data/activity-codes', label: 'Activity Codes', icon: '🏷️' },
            { href: '/platform-data/master-data/disciplines', label: 'Disciplines', icon: '🛠️' },
            { href: '/platform-data/master-data/resources', label: 'Resources', icon: '🏗️' },
            { href: '/platform-data/master-data/item-catalog', label: 'Item Catalog', icon: '📦' },
        ],
    },
    {
        title: 'Templates & Configuration',
        description: 'Reusable templates for workpacks, documents, and certificates',
        color: 'purple',
        items: [
            { href: '/platform-data/workpack-templates', label: 'Workpack Templates', icon: '📋' },
            { href: '/platform-data/udf-definitions', label: 'UDF Definitions', icon: '📝' },
            { href: '/platform-data/certificate-templates', label: 'Certificate Templates', icon: '📜' },
            { href: '/platform-data/print-settings', label: 'Print & PDF Settings', icon: '🖨️' },
        ],
    },
];

const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
};

export default async function PlatformDataPage() {
    await requireDataAdminContext();

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Platform Data Management</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Manage global templates and reference data shared across all tenant organisations.
                </p>
            </div>

            <div className="space-y-8">
                {SECTIONS.map((section) => (
                    <div key={section.title}>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${colorMap[section.color]}`}>
                            {section.title}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{section.description}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {section.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group"
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors">
                                        {item.label}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
