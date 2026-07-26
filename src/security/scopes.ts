/**
 * Aurianoa OS — Security Domains
 * PLATFORM | TENANT | PROXY
 */

export const Scope = {
    PLATFORM: 'PLATFORM',
    TENANT: 'TENANT',
    PROXY: 'PROXY',
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

export const PLATFORM_ROLES = ['platform_super_admin', 'platform_admin'] as const;

export function isPlatformRole(role: string | null | undefined): boolean {
    if (!role) return false;
    const n = String(role).toLowerCase().replace(/[\s-]+/g, '_');
    return n === 'platform_super_admin' || n === 'platform_admin';
}

export function normalizeRole(role: string | null | undefined): string {
    if (!role) return '';
    return String(role).toLowerCase().trim().replace(/[\s-]+/g, '_');
}
