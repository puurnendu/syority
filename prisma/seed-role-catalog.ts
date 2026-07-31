/**
 * M5.3 — Seed Role Catalog + verification test users.
 *
 *   npx tsx prisma/seed-role-catalog.ts
 *
 * Creates:
 *   - All default Platform roles on syority-platform (only)
 *   - All default Tenant roles on demo tenant (only)
 *   - One test user per default role (password Admin@123)
 *
 * Isolation:
 *   - Platform roles NEVER created on tenant org
 *   - Tenant roles NEVER created on platform org
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { prisma, disconnect } from './seed-client';
import bcrypt from 'bcryptjs';
import {
  PLATFORM_ROLE_CATALOG,
  TENANT_ROLE_CATALOG,
} from '../src/security/roleCatalog';
import { permissionsForRoles } from '../src/lib/permissions';

const TEST_PASSWORD = process.env.ROLE_CATALOG_TEST_PASSWORD || 'Admin@123';

type UserSeed = { email: string; name: string; slug: string; position: string };

const PLATFORM_USERS: UserSeed[] = [
  {
    email: 'info@syority.com',
    name: 'Platform Super Admin',
    slug: 'platform_super_admin',
    position: 'Platform Super Admin',
  },
  {
    email: 'platform-pm@syority.test',
    name: 'Platform Product Manager',
    slug: 'platform_product_manager',
    position: 'Product Manager',
  },
  {
    email: 'platform-scheduler@syority.test',
    name: 'Platform Master Scheduler',
    slug: 'platform_master_scheduler',
    position: 'Master Scheduler',
  },
  {
    email: 'platform-support@syority.test',
    name: 'Platform Support',
    slug: 'platform_support',
    position: 'Support Engineer',
  },
  {
    email: 'platform-finance@syority.test',
    name: 'Platform Finance',
    slug: 'platform_finance',
    position: 'Finance',
  },
];

const TENANT_USERS: UserSeed[] = [
  {
    email: 'tenant-admin@syority.test',
    name: 'Tenant Administrator',
    slug: 'tenant_administrator',
    position: 'Tenant Administrator',
  },
  {
    email: 'lead-planner@syority.test',
    name: 'Lead Planner',
    slug: 'lead_planner',
    position: 'Lead Planner',
  },
  {
    email: 'planner@syority.test',
    name: 'Planner',
    slug: 'planner',
    position: 'Planner',
  },
  {
    email: 'scheduler@syority.test',
    name: 'Scheduler',
    slug: 'scheduler',
    position: 'Scheduler',
  },
  {
    email: 'pm@syority.test',
    name: 'Project Manager',
    slug: 'project_manager',
    position: 'Project Manager',
  },
  {
    email: 'safety@syority.test',
    name: 'Safety Officer',
    slug: 'safety_officer',
    position: 'Safety Officer',
  },
  {
    email: 'qaqc@syority.test',
    name: 'QA/QC Inspector',
    slug: 'qa_qc_inspector',
    position: 'QA/QC Inspector',
  },
  {
    email: 'materials@syority.test',
    name: 'Material Coordinator',
    slug: 'material_coordinator',
    position: 'Material Coordinator',
  },
  {
    email: 'viewer@syority.test',
    name: 'Viewer',
    slug: 'viewer',
    position: 'Viewer',
  },
];

async function upsertRole(
  orgId: string,
  entry: { slug: string; name: string; isSystem: boolean }
) {
  const perms = permissionsForRoles([entry.slug]);
  const existing = await prisma.role.findFirst({
    where: { organization_id: orgId, slug: entry.slug },
  });
  if (existing) {
    return prisma.role.update({
      where: { id: existing.id },
      data: {
        name: entry.name,
        permissions: perms,
        is_system: entry.isSystem,
        updated_at: new Date(),
      },
    });
  }
  return prisma.role.create({
    data: {
      id: randomUUID(),
      organization_id: orgId,
      name: entry.name,
      slug: entry.slug,
      permissions: perms,
      is_system: entry.isSystem,
      updated_at: new Date(),
    },
  });
}

async function upsertUserWithRole(opts: {
  orgId: string;
  siteId: string | null;
  user: UserSeed;
  roleId: string;
  isPlatform: boolean;
}) {
  const hash = await bcrypt.hash(TEST_PASSWORD, 12);
  let dbUser = await prisma.user.findUnique({ where: { email: opts.user.email } });
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        organization_id: opts.orgId,
        site_id: opts.siteId,
        name: opts.user.name,
        email: opts.user.email,
        password: hash,
        position: opts.user.position,
        is_active: true,
        is_super_admin: opts.isPlatform && opts.user.slug === 'platform_super_admin',
        is_tenant_admin: !opts.isPlatform && opts.user.slug === 'tenant_administrator',
        must_change_password: false,
      },
    });
  } else {
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        organization_id: opts.orgId,
        site_id: opts.siteId,
        name: opts.user.name,
        password: hash,
        position: opts.user.position,
        is_active: true,
        must_change_password: false,
        is_super_admin: opts.isPlatform && opts.user.slug === 'platform_super_admin',
        is_tenant_admin: !opts.isPlatform && opts.user.slug === 'tenant_administrator',
      },
    });
  }

  const existingUR = await prisma.userRole.findFirst({
    where: { user_id: dbUser.id, role_id: opts.roleId },
  });
  if (!existingUR) {
    // Remove other roles for clean persona (test users are single-role)
    await prisma.userRole.deleteMany({ where: { user_id: dbUser.id } });
    await prisma.userRole.create({
      data: {
        id: randomUUID(),
        organization_id: opts.orgId,
        user_id: dbUser.id,
        role_id: opts.roleId,
        assigned_by: dbUser.id,
      },
    });
  }

  return dbUser;
}

async function main() {
  console.log('🔐 M5.3 Role Catalog seed…');

  // ── Platform org ──────────────────────────────────────────────────────────
  let platformOrg = await prisma.organization.findFirst({
    where: { slug: 'syority-platform', deleted_at: null },
  });
  if (!platformOrg) {
    platformOrg = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: 'Syority Platform',
        slug: 'syority-platform',
        industry: 'Software',
        tenant_type: 'platform',
        is_active: true,
        updated_at: new Date(),
      },
    });
  } else if ((platformOrg.tenant_type || '').toLowerCase() !== 'platform') {
    platformOrg = await prisma.organization.update({
      where: { id: platformOrg.id },
      data: { tenant_type: 'platform' },
    });
  }
  console.log('✅ Platform org:', platformOrg.slug);

  let platformSite = await prisma.site.findFirst({
    where: { organization_id: platformOrg.id, deleted_at: null },
  });
  if (!platformSite) {
    platformSite = await prisma.site.create({
      data: {
        id: randomUUID(),
        organization_id: platformOrg.id,
        name: 'Syority HQ',
        code: 'HQ',
        is_active: true,
        updated_at: new Date(),
      },
    });
  }

  // Strip any tenant roles accidentally on platform org
  const rogueTenantOnPlatform = await prisma.role.findMany({
    where: {
      organization_id: platformOrg.id,
      slug: { in: TENANT_ROLE_CATALOG.map((r) => r.slug) },
    },
  });
  for (const r of rogueTenantOnPlatform) {
    console.warn(`⚠️  Removing tenant role "${r.slug}" from platform org`);
    await prisma.userRole.deleteMany({ where: { role_id: r.id } });
    await prisma.role.delete({ where: { id: r.id } });
  }

  const platformRoleIds: Record<string, string> = {};
  for (const entry of PLATFORM_ROLE_CATALOG) {
    const role = await upsertRole(platformOrg.id, {
      slug: entry.slug,
      name: entry.name,
      isSystem: entry.isSystem,
    });
    platformRoleIds[entry.slug] = role.id;
    console.log('  · Platform role', entry.slug);
  }

  for (const u of PLATFORM_USERS) {
    const roleId = platformRoleIds[u.slug];
    if (!roleId) throw new Error(`Missing platform role ${u.slug}`);
    await upsertUserWithRole({
      orgId: platformOrg.id,
      siteId: platformSite.id,
      user: u,
      roleId,
      isPlatform: true,
    });
    console.log('  · Platform user', u.email, '→', u.slug);
  }

  // ── Demo tenant org ───────────────────────────────────────────────────────
  let tenantOrg = await prisma.organization.findFirst({
    where: {
      deleted_at: null,
      OR: [{ slug: 'syority-demo-tenant' }, { slug: 'auriana-demo' }],
      NOT: { tenant_type: 'platform' },
    },
    orderBy: { created_at: 'asc' },
  });
  if (!tenantOrg) {
    tenantOrg = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: 'Syority Demo Tenant',
        slug: 'syority-demo-tenant',
        industry: 'Oil & Gas',
        tenant_type: 'refinery',
        is_active: true,
        updated_at: new Date(),
      },
    });
  }
  console.log('✅ Tenant org:', tenantOrg.slug);

  let tenantSite = await prisma.site.findFirst({
    where: { organization_id: tenantOrg.id, deleted_at: null },
  });
  if (!tenantSite) {
    tenantSite = await prisma.site.create({
      data: {
        id: randomUUID(),
        organization_id: tenantOrg.id,
        name: 'Demo Refinery',
        code: 'REF1',
        is_active: true,
        updated_at: new Date(),
      },
    });
  }

  // Strip any platform roles accidentally on tenant org
  const roguePlatformOnTenant = await prisma.role.findMany({
    where: {
      organization_id: tenantOrg.id,
      OR: [
        { slug: { startsWith: 'platform_' } },
        { slug: { in: PLATFORM_ROLE_CATALOG.map((r) => r.slug) } },
      ],
    },
  });
  for (const r of roguePlatformOnTenant) {
    console.warn(`⚠️  Removing platform role "${r.slug}" from tenant org`);
    await prisma.userRole.deleteMany({ where: { role_id: r.id } });
    await prisma.role.delete({ where: { id: r.id } });
  }

  const tenantRoleIds: Record<string, string> = {};
  for (const entry of TENANT_ROLE_CATALOG) {
    const role = await upsertRole(tenantOrg.id, {
      slug: entry.slug,
      name: entry.name,
      isSystem: entry.isSystem,
    });
    tenantRoleIds[entry.slug] = role.id;
    console.log('  · Tenant role', entry.slug);
  }

  for (const u of TENANT_USERS) {
    const roleId = tenantRoleIds[u.slug];
    if (!roleId) throw new Error(`Missing tenant role ${u.slug}`);
    await upsertUserWithRole({
      orgId: tenantOrg.id,
      siteId: tenantSite.id,
      user: u,
      roleId,
      isPlatform: false,
    });
    console.log('  · Tenant user', u.email, '→', u.slug);
  }

  console.log('\n🎉 Role catalog seed complete');
  console.log(`   Password for all test users: ${TEST_PASSWORD}`);
  console.log('   Platform users:');
  for (const u of PLATFORM_USERS) console.log(`     ${u.email} → ${u.slug}`);
  console.log('   Tenant users:');
  for (const u of TENANT_USERS) console.log(`     ${u.email} → ${u.slug}`);
}

main()
  .then(() => disconnect())
  .catch(async (e) => {
    console.error(e);
    await disconnect();
    process.exit(1);
  });
