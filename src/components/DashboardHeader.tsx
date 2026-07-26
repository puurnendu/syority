'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardNavDropdown, type NavDropdownItem } from '@/components/DashboardNavDropdown';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UserMenu } from '@/components/UserMenu';

export type DashboardHeaderProps = {
  planningItems: NavDropdownItem[];
  executionItems: NavDropdownItem[];
  intelligenceItems: NavDropdownItem[];
  adminItems: NavDropdownItem[];
  showAdmin: boolean;
  user: { name?: string | null; email?: string | null };
  orgName: string;
};

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
        isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
      }`}
    >
      {label}
    </Link>
  );
}

export function DashboardHeader({
  planningItems,
  executionItems,
  intelligenceItems,
  adminItems,
  showAdmin,
  user,
  orgName,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const [branding, setBranding] = useState<{
    logoUrl: string | null;
    platformName: string;
    logoWidthPx: number;
    logoHeightPx: number;
  }>({
    logoUrl: null,
    platformName: 'SYORITY',
    logoWidthPx: 140,
    logoHeightPx: 40,
  });

  useEffect(() => {
    fetch('/api/admin/superadmin/branding')
      .then((r) => r.json())
      .then((d) => {
        if (d.branding) setBranding(d.branding);
      })
      .catch(() => {}); // silently fail — fallback to default
  }, []);

  return (
    <div className="h-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center overflow-hidden w-full">
      <div className="flex items-center gap-1">
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0 mr-2">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.platformName}
              style={{
                width: branding.logoWidthPx,
                height: branding.logoHeightPx,
                objectFit: 'contain',
              }}
            />
          ) : (
            <>
              <span className="text-base font-black tracking-tight text-blue-700">{branding.platformName}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                PLATFORM
              </span>
            </>
          )}
        </Link>
        <nav className="hidden lg:flex items-center gap-1">
          <NavLink href="/dashboard" label="Dashboard" />
          <DashboardNavDropdown
            label="Planning"
            isActive={['/events', '/workpacks', '/schedule', '/asset-register'].some((p) =>
              pathname.startsWith(p)
            )}
            items={planningItems}
          />
          <DashboardNavDropdown
            label="Execution"
            isActive={['/whatsapp-reviews', '/shift-reports', '/constraints', '/operations'].some((p) =>
              pathname.startsWith(p)
            )}
            items={executionItems}
          />
          <DashboardNavDropdown
            label="Intelligence"
            isActive={['/portfolio', '/lessons'].some((p) => pathname.startsWith(p))}
            items={intelligenceItems}
          />
          {showAdmin && adminItems.length > 0 && (
            <DashboardNavDropdown
              label="Admin"
              isActive={pathname.startsWith('/settings') || pathname.startsWith('/admin')}
              items={adminItems}
            />
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <NotificationBell />
        <UserMenu user={user} orgName={orgName} />
      </div>
    </div>
  );
}
