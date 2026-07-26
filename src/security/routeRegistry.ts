/**
 * Route registry — every UI path declares requiredScope (+ optional permission).
 * Middleware and layouts consume this; menus never invent access.
 */
import { Scope } from './scopes';
import type { Permission } from '@/lib/permissions';

export type RouteMeta = {
    /** Path prefix or exact path */
    path: string;
    scope: Scope;
    /** If set, role must also hold this permission (tenant scope) */
    permission?: Permission;
    /** Exact match only when true */
    exact?: boolean;
    note?: string;
};

/**
 * Longest-prefix match registry.
 * PLATFORM paths are unreachable to tenant roles.
 * TENANT paths require tenant session (platform admin needs PROXY).
 */
export const ROUTE_REGISTRY: RouteMeta[] = [
    // ── Platform console ──────────────────────────────────────────────
    { path: '/platform', scope: Scope.PLATFORM, note: 'Platform admin console' },
    { path: '/platform-data', scope: Scope.PLATFORM, note: 'Global master data' },

    // ── Platform-only surfaces wrongly living under tenant tree ───────
    { path: '/dashboard/ai-config', scope: Scope.PLATFORM, note: 'AI providers — platform only' },
    { path: '/settings/system', scope: Scope.PLATFORM, note: 'SMTP / system — platform only' },
    { path: '/settings/ai-config', scope: Scope.PLATFORM, note: 'Legacy AI config URL' },

    // ── Tenant settings ───────────────────────────────────────────────
    { path: '/settings/users', scope: Scope.TENANT, permission: 'settings.users.view' },
    { path: '/settings/roles', scope: Scope.TENANT, permission: 'settings.roles.view' },
    { path: '/settings/organization', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/sites', scope: Scope.TENANT, permission: 'site.view' },
    { path: '/settings/plants', scope: Scope.TENANT, permission: 'plant.view' },
    { path: '/settings/hierarchy/sites', scope: Scope.TENANT, permission: 'site.view' },
    { path: '/settings/hierarchy/plants', scope: Scope.TENANT, permission: 'plant.view' },
    { path: '/settings/hierarchy/areas', scope: Scope.TENANT, permission: 'area.view' },
    { path: '/settings/hierarchy/units', scope: Scope.TENANT, permission: 'unit.view' },
    { path: '/settings/hierarchy/systems', scope: Scope.TENANT, permission: 'system.view' },
    { path: '/settings/hierarchy/assets', scope: Scope.TENANT, permission: 'asset.view' },
    { path: '/settings/hierarchy', scope: Scope.TENANT, permission: 'site.view' },
    { path: '/settings/unit-responsibilities', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/subscription', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/integrations', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/audit-logs', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/whatsapp', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/ai-prompts', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/ai-logs', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/sso', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/calendars', scope: Scope.TENANT, permission: 'settings.org.view' },
    { path: '/settings/certificate-templates', scope: Scope.TENANT, permission: 'settings.templates.view' },
    { path: '/settings/clearance-parties', scope: Scope.TENANT, permission: 'settings.clearance.view' },
    { path: '/settings/profile', scope: Scope.TENANT, permission: 'settings.view' },
    { path: '/settings/notifications', scope: Scope.TENANT, permission: 'settings.view' },
    { path: '/settings', scope: Scope.TENANT, permission: 'settings.view' },

    // ── Tenant operations ─────────────────────────────────────────────
    { path: '/dashboard', scope: Scope.TENANT },
    { path: '/workpacks', scope: Scope.TENANT, permission: 'workpacks.view' },
    { path: '/events', scope: Scope.TENANT, permission: 'events.view' },
    { path: '/projects', scope: Scope.TENANT, permission: 'projects.view' },
    { path: '/planning', scope: Scope.TENANT },
    { path: '/schedule', scope: Scope.TENANT, permission: 'workpacks.view' },
    { path: '/reporting', scope: Scope.TENANT, permission: 'reporting:view' },
    { path: '/safety', scope: Scope.TENANT, permission: 'safety.view' },
    { path: '/documents', scope: Scope.TENANT, permission: 'documents.view' },
    { path: '/integrations', scope: Scope.TENANT, permission: 'workpacks.view' },
    { path: '/asset-register', scope: Scope.TENANT, permission: 'workpacks.view' },
];

export function matchRoute(pathname: string): RouteMeta | null {
    const sorted = [...ROUTE_REGISTRY].sort((a, b) => b.path.length - a.path.length);
    for (const meta of sorted) {
        if (meta.exact) {
            if (pathname === meta.path) return meta;
            continue;
        }
        if (pathname === meta.path || pathname.startsWith(meta.path + '/')) {
            return meta;
        }
    }
    return null;
}
