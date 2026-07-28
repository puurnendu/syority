import { describe, expect, it } from 'vitest';
import {
  assertRoleAllowedForOrgScope,
  PLATFORM_ROLE_CATALOG,
  TENANT_ROLE_CATALOG,
  isCatalogPlatformRole,
} from '../roleCatalog';
import { assertTenantIsolation, ROLE_PERMISSIONS } from '@/lib/permissions';
import { isPlatformRole } from '../scopes';

describe('M5.3 Role Catalog isolation', () => {
  it('marks all platform catalog roles as platform', () => {
    for (const r of PLATFORM_ROLE_CATALOG) {
      expect(isCatalogPlatformRole(r.slug)).toBe(true);
      expect(isPlatformRole(r.slug)).toBe(true);
    }
  });

  it('marks tenant catalog roles as non-platform', () => {
    for (const r of TENANT_ROLE_CATALOG) {
      expect(isCatalogPlatformRole(r.slug)).toBe(false);
      expect(isPlatformRole(r.slug)).toBe(false);
    }
  });

  it('forbids platform roles inside tenant orgs', () => {
    expect(() =>
      assertRoleAllowedForOrgScope('platform_super_admin', 'refinery')
    ).toThrow(/cannot be assigned inside a tenant/);
  });

  it('forbids tenant roles on platform org', () => {
    expect(() =>
      assertRoleAllowedForOrgScope('planner', 'platform')
    ).toThrow(/cannot be assigned to the platform/);
  });

  it('allows matching scopes', () => {
    expect(() =>
      assertRoleAllowedForOrgScope('platform_finance', 'platform')
    ).not.toThrow();
    expect(() =>
      assertRoleAllowedForOrgScope('tenant_administrator', 'refinery')
    ).not.toThrow();
  });

  it('ensures no tenant role carries platform-only permissions', () => {
    for (const r of TENANT_ROLE_CATALOG) {
      expect(assertTenantIsolation(r.slug)).toBe(true);
      const perms = ROLE_PERMISSIONS[r.slug] || [];
      expect(perms).not.toContain('nav.admin');
      expect(perms).not.toContain('nav.billing');
      expect(perms).not.toContain('knowledge.view');
      expect(perms).not.toContain('knowledge.review');
      expect(perms).not.toContain('knowledge.admin');
    }
  });

  it('gives Knowledge Engine review only to intended platform roles', () => {
    expect(ROLE_PERMISSIONS.platform_super_admin).toContain('knowledge.review');
    expect(ROLE_PERMISSIONS.platform_product_manager).toContain('knowledge.review');
    expect(ROLE_PERMISSIONS.platform_master_scheduler).toContain('knowledge.review');
    expect(ROLE_PERMISSIONS.platform_support).toContain('knowledge.view');
    expect(ROLE_PERMISSIONS.platform_support).not.toContain('knowledge.review');
    expect(ROLE_PERMISSIONS.platform_finance).not.toContain('knowledge.view');
  });
});
