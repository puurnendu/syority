'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SEGMENT_LABELS: Record<string, string> = {
    'platform-data': 'Platform Data',
    'master-data': 'Master Data',
    'equipment-types': 'Equipment Types',
    'activity-codes': 'Activity Codes',
    'disciplines': 'Disciplines',
    'resources': 'Resources',
    'item-catalog': 'Item Catalog',
    'templates': 'Workpack Templates',
    'udf-definitions': 'UDF Definitions',
    'certificate-templates': 'Certificate Templates',
    'print-settings': 'Print Settings',
    'workpack-templates': 'Workpack Templates',
};

export default function PlatformDataBreadcrumb() {
    const pathname = usePathname();

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return null;

    const crumbs: { label: string; href: string }[] = [];
    let accumulated = '';

    for (const seg of segments) {
        accumulated += `/${seg}`;
        crumbs.push({
            label: SEGMENT_LABELS[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            href: accumulated,
        });
    }

    return (
        <div className="bg-white border-b border-gray-100 px-6 py-2">
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 max-w-screen-2xl mx-auto">
                {crumbs.map((crumb, i) => (
                    <span key={crumb.href} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-gray-300">/</span>}
                        {i === crumbs.length - 1 ? (
                            <span className="font-semibold text-gray-700">{crumb.label}</span>
                        ) : (
                            <Link
                                href={crumb.href}
                                className="hover:text-blue-600 transition-colors"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </span>
                ))}
            </nav>
        </div>
    );
}
