'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavLink = { href: string; label: string; icon: string };

export function DashboardNavLinks({ navLinks }: { navLinks: NavLink[] }) {
    const pathname = usePathname();
    const [navCounts, setNavCounts] = useState<{
        open_constraints: number;
        draft_lessons: number;
        whatsapp_pending?: number;
    }>({ open_constraints: 0, draft_lessons: 0, whatsapp_pending: 0 });

    useEffect(() => {
        fetch('/api/nav/counts')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d) setNavCounts(d);
            })
            .catch(() => {});
    }, []);

    return (
        <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
                const isConstraints = link.href === '/constraints';
                const isLessons = link.href === '/lessons';
                const isWhatsapp = link.href === '/whatsapp-reviews';
                const badge = isConstraints ? navCounts.open_constraints : isLessons ? navCounts.draft_lessons : isWhatsapp ? (navCounts.whatsapp_pending ?? 0) : null;
                const badgeColor = isConstraints ? 'red' : isWhatsapp ? 'red' : 'amber';
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href + '/'));

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                            isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                        }`}
                    >
                        <span className="text-sm">{link.icon}</span>
                        {link.label}
                        {badge != null && badge > 0 && (
                            <span
                                className={`ml-auto flex-none text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center leading-none ${
                                    badgeColor === 'red'
                                        ? 'bg-red-500 text-white'
                                        : badgeColor === 'amber'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-blue-500 text-white'
                                }`}
                            >
                                {badge > 99 ? '99+' : badge}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
