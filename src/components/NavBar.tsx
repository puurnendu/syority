'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOutToLogin } from '@/lib/authClient';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UserMenu } from './UserMenu';

type NavItem = { href: string; label: string };

// ── Context Mode Pill ────────────────────────────────────────────────────

function ContextPill({
  showPlatform,
  showPlatformData,
  isProxy,
  orgName,
  currentRole,
  onExitProxy,
}: {
  showPlatform: boolean;
  showPlatformData: boolean;
  isProxy: boolean;
  orgName: string;
  currentRole: string;
  onExitProxy: () => void;
}) {
  const pathname = usePathname();

  if (isProxy) {
    return (
      <span className="hidden sm:flex items-center gap-2 ml-2 flex-shrink-0">
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-full text-xs font-semibold text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Proxying: {orgName}
        </span>
        <button
          type="button"
          onClick={onExitProxy}
          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-full transition-colors"
        >
          Exit Proxy
        </button>
      </span>
    );
  }

  if (showPlatform || (pathname.startsWith('/platform') && !pathname.startsWith('/platform-data'))) {
    return (
      <span className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-blue-100 border border-blue-300 rounded-full text-xs font-semibold text-blue-800 flex-shrink-0">
        🔷 Platform
      </span>
    );
  }

  if (showPlatformData || pathname.startsWith('/platform-data')) {
    return (
      <span className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-purple-100 border border-purple-300 rounded-full text-xs font-semibold text-purple-800 flex-shrink-0">
        🟣 Master Data
      </span>
    );
  }

  return (
    <span className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-full text-xs font-medium text-gray-600 flex-shrink-0">
      🏢 {orgName}
    </span>
  );
}

// ── NavDropdown ─────────────────────────────────────────────────────────

function NavDropdown({
  label,
  items,
  isActive,
}: {
  label: string;
  items: NavItem[];
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors select-none ${
          isActive
            ? 'text-[#0D2137] bg-blue-50'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        {label}
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[100]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'text-[#0D2137] font-medium bg-blue-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NavLink (standalone item) ───────────────────────────────────────────

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? 'text-[#0D2137] bg-blue-50'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}



// ── Mobile Drawer ───────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
  allGroups,
  pathname,
  platformName,
  homeLinkHref,
  homeLinkLabel,
}: {
  open: boolean;
  onClose: () => void;
  allGroups: { label: string; items: NavItem[] }[];
  pathname: string;
  platformName: string;
  homeLinkHref: string;
  homeLinkLabel: string;
}) {
  // Close on route change
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Slide-in panel */}
      <div className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-base font-black tracking-tight text-blue-700">{platformName}</span>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-2">
          <Link
            href={homeLinkHref}
            className={`block px-4 py-2.5 text-sm font-medium ${
              pathname === homeLinkHref ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {homeLinkLabel}
          </Link>

          {allGroups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.label} className="mt-1">
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-2.5 text-sm ${
                      pathname === item.href || pathname.startsWith(item.href + '/')
                        ? 'text-blue-700 font-medium bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => signOutToLogin()}
            className="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium py-2"
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main NavBar export ──────────────────────────────────────────────────

export type NavBarProps = {
  planningItems: NavItem[];
  executionItems: NavItem[];
  intelligenceItems: NavItem[];
  importExportItems: NavItem[];
  safetyItem?: NavItem | null;
  documentItem?: NavItem | null;
  adminItems: NavItem[];
  platformItems: NavItem[];
  tenantsItems: NavItem[];
  platformDataItems?: NavItem[];
  showAdmin: boolean;
  showPlatform: boolean;
  showPlatformData?: boolean;
  showNotifications?: boolean;
  isProxy?: boolean;
  currentRole?: string;
  user: { name?: string | null; email?: string | null };
  orgName: string;
  /** Override the home link shown in the mobile drawer. Defaults to Dashboard. */
  homeLinkHref?: string;
  homeLinkLabel?: string;
};

export default function NavBar({
  planningItems,
  executionItems,
  intelligenceItems,
  importExportItems,
  safetyItem,
  documentItem,
  adminItems,
  platformItems,
  tenantsItems,
  platformDataItems = [],
  showAdmin,
  showPlatform,
  showPlatformData = false,
  showNotifications = true,
  isProxy = false,
  currentRole = '',
  user,
  orgName,
  homeLinkHref,
  homeLinkLabel,
}: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
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

  // ── Project-Aware Navigation ───────────────────────────────────────────
  const projectId = pathname.startsWith('/projects/') ? pathname.split('/')[2] : null;

  const rewriteItems = useCallback((items: NavItem[]) => {
    if (!projectId) return items;
    return items.map((item) => {
      if (item.href === '/workpacks') return { ...item, href: `/projects/${projectId}/workpacks` };
      if (item.href === '/schedule') return { ...item, label: 'Execution Schedule', href: `/projects/${projectId}/schedule` };
      if (item.href === '/imported-schedule') return { ...item, label: 'Baseline Schedule', href: `/projects/${projectId}/imported-schedule` };
      if (item.href === '/asset-register') return { ...item, href: `/projects/${projectId}/equipment` };
      if (item.href === '/constraints') return { ...item, href: `/projects/${projectId}/constraints` };
      if (item.href === '/punch') return { ...item, href: `/projects/${projectId}/punch` };
      if (item.href === '/permits') return { ...item, href: `/projects/${projectId}/permits` };
      if (item.href === '/safety') return { ...item, href: `/projects/${projectId}/safety` };
      if (item.href === '/reporting') return { ...item, href: `/projects/${projectId}/reports` };
      return item;
    });
  }, [projectId]);

  const handleExitProxy = useCallback(async () => {
    await fetch('/api/proxy/exit', { method: 'POST' });
    router.push('/platform/tenants');
    router.refresh();
  }, [router]);

  const finalPlanningItems = rewriteItems(planningItems);
  const finalExecutionItems = rewriteItems(executionItems);
  const finalIntelligenceItems = rewriteItems(intelligenceItems);

  // Groups used for mobile drawer
  const mobileGroups = [
    { label: 'Planning', items: finalPlanningItems },
    { label: 'Execution', items: finalExecutionItems },
    { label: 'Intelligence', items: finalIntelligenceItems },
    { label: 'Import / Export', items: importExportItems },
    ...(safetyItem ? [{ label: 'Safety', items: [safetyItem] }] : []),
    ...(documentItem ? [{ label: 'Documents', items: [documentItem] }] : []),
    ...(showAdmin && adminItems.length > 0 ? [{ label: 'Org Settings', items: adminItems }] : []),
    ...(showPlatformData && platformDataItems.length > 0 ? [{ label: 'Master Data', items: platformDataItems }] : []),
    ...(showPlatform && tenantsItems.length > 0 ? [{ label: 'Tenants', items: tenantsItems }] : []),
    ...(showPlatform && platformItems.length > 0 ? [{ label: 'Platform', items: platformItems }] : []),
  ];

  // Resolve mobile drawer home link
  const resolvedHomeLinkHref = homeLinkHref ?? '/dashboard';
  const resolvedHomeLinkLabel = homeLinkLabel ?? 'Dashboard';

  return (
    <>
      <div className="h-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center w-full min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          {/* Hamburger — visible only below lg */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 mr-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Open navigation menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo — href is role-aware */}
          <Link
            href={showPlatform ? '/platform/tenants' : '/dashboard'}
            className="flex items-center gap-2 flex-shrink-0 mr-2"
          >
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
                <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-widest text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                  PLATFORM
                </span>
              </>
            )}
          </Link>

          {/* Context indicator + Exit Proxy */}
          <ContextPill
            showPlatform={showPlatform}
            showPlatformData={showPlatformData}
            isProxy={isProxy}
            orgName={orgName}
            currentRole={currentRole}
            onExitProxy={handleExitProxy}
          />

          {/* Desktop nav — hidden below lg */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0">
            <NavLink href="/dashboard" label="Dashboard" />
            <NavDropdown
              label="Planning"
              isActive={['/events', '/workpacks', '/schedule', '/asset-register'].some((p) =>
                pathname.startsWith(p)
              )}
              items={finalPlanningItems}
            />
            <NavDropdown
              label="Execution"
              isActive={['/constraints', '/operations', '/punch', '/permits'].some(
                (p) => pathname.startsWith(p)
              )}
              items={finalExecutionItems}
            />
            <NavDropdown
              label="Intelligence"
              isActive={['/portfolio', '/lessons', '/reporting', '/shift-reports', '/whatsapp-reviews'].some((p) => pathname.startsWith(p))}
              items={finalIntelligenceItems}
            />
            <NavDropdown
              label="Import / Export"
              isActive={pathname.startsWith('/integrations')}
              items={importExportItems}
            />
            {safetyItem && <NavLink href={safetyItem.href} label={safetyItem.label} />}
            {documentItem && <NavLink href={documentItem.href} label={documentItem.label} />}
            {/* Visual divider between execution and admin/config nav groups */}
            {(showAdmin || showPlatformData || showPlatform) && (
              <span className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0" aria-hidden="true" />
            )}
            {showAdmin && adminItems.length > 0 && (
              <NavDropdown
                label="Org Settings"
                isActive={pathname.startsWith('/settings') || (pathname.startsWith('/admin') && !showPlatform)}
                items={adminItems}
              />
            )}
            {showPlatformData && platformDataItems.length > 0 && (
              <NavDropdown
                label="Master Data"
                isActive={pathname.startsWith('/platform-data')}
                items={platformDataItems}
              />
            )}
            {showPlatform && tenantsItems.length > 0 && (
              <NavDropdown
                label="Tenants"
                isActive={pathname.startsWith('/platform/tenants')}
                items={tenantsItems}
              />
            )}
            {showPlatform && platformItems.length > 0 && (
              <NavDropdown
                label="Platform"
                isActive={pathname.startsWith('/platform') && !pathname.startsWith('/platform-data')}
                items={platformItems}
              />
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {showNotifications && <NotificationBell />}
          <UserMenu user={user} orgName={orgName} currentRole={currentRole} isProxy={isProxy} />
        </div>
      </div>

      {/* Mobile slide-in drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        allGroups={mobileGroups}
        pathname={pathname}
        platformName={branding.platformName}
        homeLinkHref={resolvedHomeLinkHref}
        homeLinkLabel={resolvedHomeLinkLabel}
      />
    </>
  );
}
