/**
 * Aurianoa OS — Security Domains
 * PLATFORM | TENANT | PROXY
 */
import { ALL_PLATFORM_ROLE_SLUGS } from './roleCatalog';

export const Scope = {
  PLATFORM: 'PLATFORM',
  TENANT: 'TENANT',
  PROXY: 'PROXY',
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

/** Canonical platform role slugs (M5.3 freeze). */
export const PLATFORM_ROLES = [
  'platform_super_admin',
  'platform_product_manager',
  'platform_master_scheduler',
  'platform_support',
  'platform_finance',
  'platform_admin', // legacy
] as const;

export function isPlatformRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const n = String(role).toLowerCase().replace(/[\s-]+/g, '_');
  if ((ALL_PLATFORM_ROLE_SLUGS as readonly string[]).includes(n)) return true;
  // Defense-in-depth: any platform_* slug is platform-scoped
  return n.startsWith('platform_');
}

export function normalizeRole(role: string | null | undefined): string {
  if (!role) return '';
  return String(role).toLowerCase().trim().replace(/[\s-]+/g, '_');
}
