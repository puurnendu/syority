/**
 * M7.6F — Permissions System Unit Tests
 *
 * Validates role-permission matrix, tenant isolation, BRE permissions,
 * and role alias resolution.
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  permissionsForRoles,
  assertTenantIsolation,
  resolveRoleSlug,
  ROLE_PERMISSIONS,
} from '../../lib/permissions';

// ─── Role Alias Resolution ──────────────────────────────────────────────────

describe('resolveRoleSlug', () => {
  it('resolves super_admin to tenant_administrator', () => {
    expect(resolveRoleSlug('super_admin')).toBe('tenant_administrator');
  });

  it('resolves platform_superadmin to platform_super_admin', () => {
    expect(resolveRoleSlug('platform_superadmin')).toBe('platform_super_admin');
  });

  it('passes through unknown slugs unchanged', () => {
    expect(resolveRoleSlug('viewer')).toBe('viewer');
  });

  it('normalizes case and whitespace', () => {
    expect(resolveRoleSlug('Super Admin')).toBe('tenant_administrator');
  });
});

// ─── hasPermission ──────────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('returns false for null/undefined role', () => {
    expect(hasPermission(null, 'workpacks.view')).toBe(false);
    expect(hasPermission(undefined, 'workpacks.view')).toBe(false);
  });

  it('tenant_administrator has workpack permissions', () => {
    expect(hasPermission('tenant_administrator', 'workpacks.view')).toBe(true);
    expect(hasPermission('tenant_administrator', 'workpacks.create')).toBe(true);
    expect(hasPermission('tenant_administrator', 'workpacks.approve')).toBe(true);
  });

  it('viewer has workpacks.view', () => {
    expect(hasPermission('viewer', 'workpacks.view')).toBe(true);
  });

  it('viewer does NOT have workpacks.create', () => {
    expect(hasPermission('viewer', 'workpacks.create')).toBe(false);
  });

  it('tenant_administrator has safety permissions', () => {
    expect(hasPermission('tenant_administrator', 'safety.view')).toBe(true);
    expect(hasPermission('tenant_administrator', 'safety.log')).toBe(true);
    expect(hasPermission('tenant_administrator', 'safety.edit')).toBe(true);
  });

  it('safety_officer has safety.view', () => {
    expect(hasPermission('safety_officer', 'safety.view')).toBe(true);
  });

  it('tenant_administrator has BRE permissions', () => {
    expect(hasPermission('tenant_administrator', 'bre:rules.view')).toBe(true);
    expect(hasPermission('tenant_administrator', 'bre:rules.edit')).toBe(true);
    expect(hasPermission('tenant_administrator', 'bre:alerts.view')).toBe(true);
    expect(hasPermission('tenant_administrator', 'bre:alerts.manage')).toBe(true);
    expect(hasPermission('tenant_administrator', 'bre:recommendations.view')).toBe(true);
  });

  it('tenant_administrator has OIS permissions', () => {
    expect(hasPermission('tenant_administrator', 'ois:dashboard.view')).toBe(true);
    expect(hasPermission('tenant_administrator', 'ois:dashboard.build')).toBe(true);
    expect(hasPermission('tenant_administrator', 'ois:tv_mode')).toBe(true);
  });

  it('viewer does NOT have BRE admin permissions', () => {
    expect(hasPermission('viewer', 'bre:rules.admin')).toBe(false);
  });

  it('returns false for unknown role', () => {
    expect(hasPermission('random_role_xyz', 'workpacks.view')).toBe(false);
  });
});

// ─── hasAnyPermission / hasAllPermissions ───────────────────────────────────

describe('hasAnyPermission', () => {
  it('returns true if any permission matches', () => {
    expect(hasAnyPermission('viewer', ['workpacks.create', 'workpacks.view'])).toBe(true);
  });

  it('returns false if none match', () => {
    expect(hasAnyPermission('viewer', ['workpacks.create', 'workpacks.approve'])).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  it('returns true if all match', () => {
    expect(
      hasAllPermissions('tenant_administrator', ['workpacks.view', 'workpacks.create', 'safety.view']),
    ).toBe(true);
  });

  it('returns false if any missing', () => {
    expect(
      hasAllPermissions('viewer', ['workpacks.view', 'workpacks.create']),
    ).toBe(false);
  });
});

// ─── permissionsForRoles ────────────────────────────────────────────────────

describe('permissionsForRoles', () => {
  it('merges permissions from multiple roles', () => {
    const perms = permissionsForRoles(['viewer', 'safety_officer']);
    expect(perms).toContain('workpacks.view');
    expect(perms).toContain('safety.view');
  });

  it('deduplicates permissions', () => {
    const perms = permissionsForRoles(['viewer', 'viewer']);
    const uniquePerms = new Set(perms);
    expect(perms.length).toBe(uniquePerms.size);
  });
});

// ─── Tenant Isolation ───────────────────────────────────────────────────────

describe('assertTenantIsolation', () => {
  it('passes for platform roles', () => {
    expect(assertTenantIsolation('platform_super_admin')).toBe(true);
  });

  it('passes for tenant_administrator (no platform-only perms)', () => {
    expect(assertTenantIsolation('tenant_administrator')).toBe(true);
  });

  it('passes for viewer', () => {
    expect(assertTenantIsolation('viewer')).toBe(true);
  });

  it('passes for lead_planner', () => {
    expect(assertTenantIsolation('lead_planner')).toBe(true);
  });

  it('passes for safety_officer', () => {
    expect(assertTenantIsolation('safety_officer')).toBe(true);
  });

  // Exhaustive: every non-platform role should pass isolation
  it('all tenant roles pass isolation check', () => {
    const tenantRoles = Object.keys(ROLE_PERMISSIONS).filter((r) => !r.startsWith('platform_'));
    for (const role of tenantRoles) {
      expect(assertTenantIsolation(role)).toBe(true);
    }
  });
});
