'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TENANT_SETTINGS_NAV } from '@/security/navigation';
import { hasPermission, type Permission } from '@/lib/permissions';
import { isPlatformRole, normalizeRole } from '@/security/scopes';

/**
 * Tenant settings sidebar — rendered only from TENANT_SETTINGS_NAV metadata.
 * Platform surfaces (AI providers, SMTP/system) are intentionally absent.
 */
export function SettingsNavItems() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = normalizeRole(
    (session?.user as any)?.role ?? (session?.user as any)?.roles?.[0] ?? ''
  );
  const roles: string[] = [
    ...new Set([
      ...(role ? [role] : []),
      ...(((session?.user as any)?.roles || []) as string[]).map(normalizeRole),
    ]),
  ];

  // Platform admins in proxy still see tenant settings — never platform-only links here
  const can = (permission?: Permission) => {
    if (!permission) return true;
    if (roles.some(isPlatformRole)) return true; // proxy support
    return roles.some((r) => hasPermission(r, permission));
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const visibleGroups = TENANT_SETTINGS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)),
  })).filter(
    (group) =>
      group.items.length > 0 &&
      (!group.permission || can(group.permission))
  );

  if (visibleGroups.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-white/30">
        No settings available for your role.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => (
        <div key={group.id}>
          <div className="px-3 mb-1">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              {group.label}
            </span>
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative
                    ${active ? 'bg-white/10 text-white font-medium' : 'text-white/55 hover:text-white/90 hover:bg-white/6'}
                  `}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-full" />
                  )}
                  <span className="text-base w-5 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {active && (
                    <span className="text-white/30 flex-shrink-0" aria-hidden>
                      ›
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
