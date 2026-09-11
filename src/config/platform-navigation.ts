/**
 * M7.6H — Centralized Platform Navigation Helpers
 *
 * Single source of truth for all Platform Administration navigation.
 * Layouts and pages import from here — never define menu items inline.
 */

import { PLATFORM_NAV } from '@/security/navigation';
import { hasPermission, type Permission } from '@/lib/permissions';

// ═══════════════════════════════════════════════════════════════════════════════
// Notification Sub-Navigation (shared across 6 notification sub-pages)
// ═══════════════════════════════════════════════════════════════════════════════

export const NOTIFICATION_SUB_NAV = [
  { href: '/platform/notifications', label: 'Dashboard', icon: '📊' },
  { href: '/platform/notifications/providers', label: 'Providers', icon: '🔌' },
  { href: '/platform/notifications/templates', label: 'Templates', icon: '📝' },
  { href: '/platform/notifications/rules', label: 'Rules', icon: '⚡' },
  { href: '/platform/notifications/groups', label: 'Groups', icon: '👥' },
  { href: '/platform/notifications/queue', label: 'Queue', icon: '📬' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Layout Helpers — used by platform/layout.tsx and platform-data/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════

type SimpleNavItem = { href: string; label: string };

/**
 * Build the "Tenants" dropdown items (Tenants + Onboarding).
 */
export function buildTenantsItems(role: string): SimpleNavItem[] {
  const group = PLATFORM_NAV.find((g) => g.id === 'platform-home');
  if (!group) return [];
  const can = (perm?: string) => !perm || hasPermission(role, perm as Permission);
  return group.items
    .filter((i) => ['/platform/tenants', '/platform/onboarding'].includes(i.href) && can(i.permission))
    .map((i) => ({ href: i.href, label: i.label }));
}

/**
 * Build the "Platform" dropdown items.
 * Excludes Dashboard, Tenants, and Onboarding (they're separate nav elements).
 */
export function buildPlatformDropdownItems(role: string): SimpleNavItem[] {
  const group = PLATFORM_NAV.find((g) => g.id === 'platform-home');
  if (!group) return [];
  const can = (perm?: string) => !perm || hasPermission(role, perm as Permission);
  return group.items
    .filter(
      (i) =>
        !['/platform/dashboard', '/platform/tenants', '/platform/onboarding'].includes(i.href) &&
        can(i.permission)
    )
    .map((i) => ({ href: i.href, label: i.label }));
}

/**
 * Build the "Platform Data" dropdown items.
 */
export function buildPlatformDataItems(): SimpleNavItem[] {
  const group = PLATFORM_NAV.find((g) => g.id === 'platform-data');
  if (!group) return [];
  return group.items.map((i) => ({ href: i.href, label: i.label }));
}
