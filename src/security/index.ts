export { Scope, isPlatformRole, normalizeRole, PLATFORM_ROLES } from './scopes';
export { ROUTE_REGISTRY, matchRoute } from './routeRegistry';
export type { RouteMeta } from './routeRegistry';
export { PLATFORM_NAV, TENANT_SETTINGS_NAV, TENANT_SHELL_SECTIONS } from './navigation';
export type { NavItemMeta, NavGroupMeta } from './navigation';
export {
    canAccessRouteMeta,
    evaluatePathAccess,
    principalIsPlatform,
    principalHasPermission,
    principalRoles,
} from './access';
// NOTE: Do NOT re-export apiGuards from this barrel.
// Middleware (Edge) imports `@/security`; apiGuards → AuditService → prisma → `pg`,
// which is Node-only and breaks the Edge/Turbopack build.
// Import guards from `@/security/apiGuards` in Route Handlers instead.
export {
    resolveAuthorization,
    authHasPermission,
    displayRoleName,
} from './identity';
export type { AuthIdentity, AuthAuthorization, ResolvedAuth } from './identity';
