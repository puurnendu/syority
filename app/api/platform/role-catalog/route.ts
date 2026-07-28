import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import {
  PLATFORM_ROLE_CATALOG,
  TENANT_ROLE_CATALOG,
  LEGACY_TENANT_ROLES,
} from '@/security/roleCatalog';
import { ROLE_PERMISSIONS, assertTenantIsolation } from '@/lib/permissions';

/**
 * Frozen Role Catalog (M5.3) — metadata + permission lists for audit UI.
 */
export async function GET() {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  const attach = (entries: typeof PLATFORM_ROLE_CATALOG) =>
    entries.map((e) => ({
      ...e,
      permissions: ROLE_PERMISSIONS[e.slug] || [],
      tenant_isolation_ok:
        e.scope === 'PLATFORM' ? true : assertTenantIsolation(e.slug),
    }));

  return NextResponse.json({
    platform: attach(PLATFORM_ROLE_CATALOG),
    tenant: attach(TENANT_ROLE_CATALOG),
    legacy: attach(LEGACY_TENANT_ROLES as typeof PLATFORM_ROLE_CATALOG),
    rules: {
      platform_roles_only_on_platform_org: true,
      tenant_roles_never_access_platform_modules: true,
      knowledge_permissions: ['knowledge.view', 'knowledge.review', 'knowledge.admin'],
    },
  });
}
