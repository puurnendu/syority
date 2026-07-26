'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ── Segment label map ────────────────────────────────────────────────────
// Maps URL path segments → human-readable breadcrumb labels.
// Unknown segments are auto-formatted (kebab-case → Title Case).

const SEGMENT_LABELS: Record<string, string> = {
    // Roots
    'dashboard': 'Dashboard',
    'platform': 'Platform',
    'platform-data': 'Platform Data',

    // Platform namespace
    'tenants': 'Tenants',
    'onboarding': 'Onboarding',
    'billing': 'Billing',
    'users': 'Users',
    'system': 'System Health',
    'features': 'Feature Flags',
    'ai-config': 'AI Configuration',
    'setup': 'Setup',
    'storage': 'Storage',
    'backups': 'Backups',
    'logs': 'Logs',
    'monitoring': 'Monitoring',

    // Master Data namespace
    'master-data': 'Master Data',
    'equipment-types': 'Equipment Types',
    'activity-codes': 'Activity Codes',
    'disciplines': 'Disciplines',
    'resources': 'Resources',
    'item-catalog': 'Item Catalog',
    'templates': 'Workpack Templates',
    'udf-definitions': 'UDF Definitions',
    'certificate-templates': 'Certificate Templates',
    'print-settings': 'Print & PDF Settings',
    'workpack-templates': 'Workpack Templates',

    // Tenant dashboard namespace
    'workpacks': 'Workpacks',
    'schedule': 'Schedule',
    'imported-schedule': 'Baseline Schedule',
    'projects': 'Projects',
    'settings': 'Settings',
    'organization': 'Organisation',
    'profile': 'Profile',
    'roles': 'Roles',
    'audit-logs': 'Audit Logs',
    'integrations': 'Integrations',
    'constraints': 'Constraints',
    'punch': 'Punch List',
    'permits': 'Permits',
    'safety': 'Safety',
    'portfolio': 'Portfolio',
    'reporting': 'Intelligence',
    'shift-reports': 'Shift Reports',
    'documents': 'Documents',
    'asset-register': 'Asset Register',
    'planning': 'Planning',
    'events': 'Events / TAs',
    'sites': 'Sites',
    'hierarchy': 'Asset Hierarchy',
    'plants': 'Plants',
    'areas': 'Areas',
    'units': 'Units',
    'systems': 'Systems',
    'assets': 'Assets',
    'lessons': 'Lessons Learned',
    'new': 'New',
    'equipment': 'Equipment',
    'ta-dashboard': 'TA Dashboard',
    'lookahead': 'Lookahead',
    'reports': 'Reports',
};

function segmentToLabel(seg: string): string {
    if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
    // Auto-format unknown segments: kebab-case → Title Case
    return seg
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Props ────────────────────────────────────────────────────────────────

type GlobalBreadcrumbProps = {
    isProxy?: boolean;
    orgName?: string;
};

// ── Component ────────────────────────────────────────────────────────────

export default function GlobalBreadcrumb({ isProxy = false, orgName }: GlobalBreadcrumbProps) {
    const pathname = usePathname();

    // ── UUID detection: skip raw ID segments ─────────────────────────
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Build crumbs from URL segments — dedupe consecutive equal labels, skip UUIDs
    const rawSegments = pathname.split('/').filter(Boolean);

    // Skip breadcrumb on root-level pages (single segment depth)
    if (rawSegments.length <= 1) return null;

    // Build cumulative hrefs and deduplicate consecutive equal labels
    const allCrumbs: { label: string; href: string }[] = rawSegments
        .map((seg, i) => ({
            label: UUID_RE.test(seg) ? null : segmentToLabel(seg),
            href: '/' + rawSegments.slice(0, i + 1).join('/'),
        }))
        .filter((c): c is { label: string; href: string } => c.label !== null);

    // Remove consecutive duplicate labels
    const crumbs = allCrumbs.filter((c, i) =>
        i === 0 || c.label !== allCrumbs[i - 1].label
    );

    return (
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8">
            <nav
                aria-label="Breadcrumb"
                className="max-w-screen-2xl mx-auto flex items-center gap-1.5 py-2 text-xs text-gray-500 overflow-x-auto whitespace-nowrap"
            >
                {/* Proxy prefix — shown only when impersonating a tenant */}
                {isProxy && orgName && (
                    <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-semibold flex-shrink-0">
                            Viewing as {orgName}
                        </span>
                        <Separator />
                    </>
                )}

                {crumbs.map((crumb, i) => {
                    const isLast = i === crumbs.length - 1;
                    return (
                        <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                            {i > 0 && <Separator />}
                            {isLast ? (
                                <span className="font-semibold text-gray-800 truncate">
                                    {crumb.label}
                                </span>
                            ) : (
                                <Link
                                    href={crumb.href}
                                    className="hover:text-blue-600 transition-colors truncate"
                                >
                                    {crumb.label}
                                </Link>
                            )}
                        </span>
                    );
                })}
            </nav>
        </div>
    );
}

function Separator() {
    return (
        <svg
            className="w-3 h-3 text-gray-300 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    );
}
