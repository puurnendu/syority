'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    label: string;
    href: string;
    icon?: string;
    comingSoon?: boolean;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const SETTINGS_SECTIONS: NavSection[] = [
    {
        title: 'Organization',
        items: [
            { label: 'Organization', href: '/settings/organization', icon: '🏢' },
            { label: 'Users', href: '/settings/users', icon: '👥' },
            { label: 'Sites', href: '/settings/hierarchy/sites', icon: '📍' },
            { label: 'Plants', href: '/settings/hierarchy/plants', icon: '🏭' },
            { label: 'Areas', href: '/settings/hierarchy/areas', icon: '🗺️' },
            { label: 'Units', href: '/settings/hierarchy/units', icon: '⚙️' },
            { label: 'Systems', href: '/settings/hierarchy/systems', icon: '🔗' },
            { label: 'Assets', href: '/settings/hierarchy/assets', icon: '🏷️' },
            { label: 'Roles & Permissions', href: '/settings/roles', icon: '🔐' },
            { label: 'Clearance Parties', href: '/settings/clearance-parties', icon: '🔓' },
        ],
    },
    {
        title: 'Master Data',
        items: [
            { label: 'Activity Codes', href: '/settings/master-data/activity-codes', icon: '🔢' },
            { label: 'Disciplines', href: '/settings/master-data/disciplines', icon: '🔧' },
            { label: 'Resources', href: '/settings/master-data/resources', icon: '👷' },
            { label: 'Item Catalog', href: '/settings/items', icon: '📦' },
        ],
    },
    {
        title: 'System',
        items: [
            { label: 'UDF Definitions', href: '/settings/udf-definitions', icon: '📝' },
            { label: 'Templates', href: '/settings/templates', icon: '📋' },
            { label: 'Print & PDF Design', href: '/settings/print-settings', icon: '🖨️' },
            { label: 'Certificate Templates', href: '/settings/certificate-templates', icon: '📜' },
            { label: 'AI Configuration', href: '/settings/ai-config', icon: '🤖' },
            { label: 'Audit Logs', href: '/settings/audit-logs', icon: '📜' },
            { label: 'System', href: '/settings/system', icon: '⚙️', comingSoon: true },
            { label: 'Integrations', href: '/settings/integrations', icon: '🔌', comingSoon: true },
            { label: 'Notifications', href: '/settings/notifications', icon: '🔔', comingSoon: true },
            { label: 'Billing', href: '/settings/billing', icon: '💳', comingSoon: true },
        ],
    },
];

export function SettingsSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden">
            <div className="py-6 flex flex-col gap-8">
                {SETTINGS_SECTIONS.map((section) => (
                    <div key={section.title} className="px-3">
                        <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            {section.title}
                        </h3>
                        <nav className="space-y-0.5">
                            {section.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                            ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                                            } ${item.comingSoon ? 'opacity-75' : ''}`}
                                    >
                                        <span className="text-base w-5 flex items-center justify-center">{item.icon}</span>
                                        <span className="truncate flex-1">{item.label}</span>
                                        {item.comingSoon && (
                                            <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                                                Soon
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                ))}
            </div>
        </aside>
    );
}
