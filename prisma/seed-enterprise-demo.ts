/**
 * M5.4 — Enterprise Demo Environment
 *
 *   npm run seed:enterprise-demo
 *
 * Idempotent-ish: upserts orgs/users; skips recreating hierarchy/library if markers exist.
 * Password for all users: Admin@123
 */
import 'dotenv/config';
import { createHash, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, disconnect } from './seed-client';
import { PLATFORM_ROLE_CATALOG } from '../src/security/roleCatalog';
import { permissionsForRoles } from '../src/lib/permissions';
import {
  DEMO_TENANTS,
  PLATFORM_DEMO_USERS,
  TENANT_DEMO_ROLES,
} from './demo/tenants';
import { buildEquipmentTypes } from './demo/equipmentTypes';
import { DISCIPLINES, buildActivityCodes } from './demo/activityCodes';
import { PROCESS_UNITS, CONTRACTOR_UNITS } from './demo/hierarchy';
import { RESOURCE_TYPES, buildUdfDefinitions } from './demo/resourcesAndUdfs';
import { buildAllTemplates } from './demo/workpackTemplates';
import { CERTIFICATE_TEMPLATES, PRINT_TEMPLATE_PRESETS } from './demo/certificates';
import { buildStandardActivityTypeSeed } from './demo/seedStandardActivityTypes';

const PASSWORD = process.env.DEMO_PASSWORD || 'Admin@123';

const stats = {
  tenants: 0,
  users: 0,
  roles: 0,
  sites: 0,
  plants: 0,
  areas: 0,
  units: 0,
  systems: 0,
  assets: 0,
  equipmentTypes: 0,
  disciplines: 0,
  activityCodes: 0,
  resourceTypes: 0,
  udfs: 0,
  certificates: 0,
  printPresets: 0,
  workpackTemplates: 0,
  templateActivities: 0,
  knowledgeIncoming: 0,
  knowledgeApproved: 0,
  knowledgeRejected: 0,
  knowledgeReview: 0,
};

async function upsertRole(orgId: string, slug: string, name: string) {
  const perms = permissionsForRoles([slug]);
  const existing = await prisma.role.findFirst({ where: { organization_id: orgId, slug } });
  if (existing) {
    await prisma.role.update({
      where: { id: existing.id },
      data: { name, permissions: perms, is_system: true, updated_at: new Date() },
    });
    return existing.id;
  }
  const created = await prisma.role.create({
    data: {
      id: randomUUID(),
      organization_id: orgId,
      name,
      slug,
      permissions: perms,
      is_system: true,
      updated_at: new Date(),
    },
  });
  stats.roles++;
  return created.id;
}

async function upsertUser(opts: {
  orgId: string;
  siteId: string | null;
  email: string;
  name: string;
  position: string;
  roleId: string;
  isPlatform?: boolean;
  isTenantAdmin?: boolean;
}) {
  const hash = await bcrypt.hash(PASSWORD, 12);
  let user = await prisma.user.findUnique({ where: { email: opts.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: randomUUID(),
        organization_id: opts.orgId,
        site_id: opts.siteId,
        name: opts.name,
        email: opts.email,
        password: hash,
        position: opts.position,
        is_active: true,
        is_super_admin: !!opts.isPlatform,
        is_tenant_admin: !!opts.isTenantAdmin,
        must_change_password: false,
      },
    });
    stats.users++;
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        organization_id: opts.orgId,
        site_id: opts.siteId,
        name: opts.name,
        password: hash,
        position: opts.position,
        is_active: true,
        must_change_password: false,
        is_super_admin: !!opts.isPlatform,
        is_tenant_admin: !!opts.isTenantAdmin,
      },
    });
  }
  await prisma.userRole.deleteMany({ where: { user_id: user.id } });
  await prisma.userRole.create({
    data: {
      id: randomUUID(),
      organization_id: opts.orgId,
      user_id: user.id,
      role_id: opts.roleId,
      assigned_by: user.id,
    },
  });
  return user;
}

async function seedPlatform() {
  console.log('\n── Platform ──');
  let org = await prisma.organization.findFirst({
    where: { slug: 'syority-platform', deleted_at: null },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: 'SYORITY CORPORATION PVT LTD',
        slug: 'syority-platform',
        industry: 'Software',
        country: 'IN',
        tenant_type: 'platform',
        is_active: true,
        platform_name: 'Aurianoa OS',
        updated_at: new Date(),
      },
    });
  } else {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: 'SYORITY CORPORATION PVT LTD',
        tenant_type: 'platform',
        platform_name: 'Aurianoa OS',
        industry: 'Software',
        country: 'IN',
      },
    });
  }

  let site = await prisma.site.findFirst({
    where: { organization_id: org.id, deleted_at: null },
  });
  if (!site) {
    site = await prisma.site.create({
      data: {
        organization_id: org.id,
        name: 'Syority Corporate HQ',
        code: 'HQ',
        is_active: true,
      },
    });
    stats.sites++;
  }

  const roleIds: Record<string, string> = {};
  for (const r of PLATFORM_ROLE_CATALOG) {
    roleIds[r.slug] = await upsertRole(org.id, r.slug, r.name);
  }

  for (const u of PLATFORM_DEMO_USERS) {
    await upsertUser({
      orgId: org.id,
      siteId: site.id,
      email: u.email,
      name: u.name,
      position: u.position,
      roleId: roleIds[u.slug],
      isPlatform: u.slug === 'platform_super_admin',
    });
    console.log(`  · ${u.email}`);
  }

  return { org, site, adminUserId: (await prisma.user.findUnique({ where: { email: 'info@syority.com' } }))!.id };
}

async function seedHierarchy(
  orgId: string,
  siteId: string,
  siteCode: string,
  isRefinery: boolean
) {
  const plantCode = `${siteCode}-PLANT`;
  let plant = await prisma.plant.findFirst({
    where: { site_id: siteId, code: plantCode, deleted_at: null },
  });
  if (!plant) {
    plant = await prisma.plant.create({
      data: {
        organization_id: orgId,
        site_id: siteId,
        name: isRefinery ? `${siteCode} Process Complex` : `${siteCode} Project Complex`,
        code: plantCode,
        is_active: true,
      },
    });
    stats.plants++;
  }

  const areaCode = isRefinery ? 'PROC' : 'PROJ';
  let area = await prisma.area.findFirst({
    where: { plant_id: plant.id, code: areaCode, deleted_at: null },
  });
  if (!area) {
    area = await prisma.area.create({
      data: {
        organization_id: orgId,
        site_id: siteId,
        plant_id: plant.id,
        name: isRefinery ? 'Process Area' : 'Project Area',
        code: areaCode,
        is_active: true,
      },
    });
    stats.areas++;
  }

  const unitDefs = isRefinery ? PROCESS_UNITS : CONTRACTOR_UNITS;
  for (const u of unitDefs) {
    let unit = await prisma.unit.findFirst({
      where: { plant_id: plant.id, code: u.code, deleted_at: null },
    });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          organization_id: orgId,
          site_id: siteId,
          plant_id: plant.id,
          area_id: area.id,
          name: u.name,
          code: u.code,
          is_active: true,
        },
      });
      stats.units++;
    }
    for (const s of u.systems) {
      let system = await prisma.system.findFirst({
        where: { unit_id: unit.id, code: s.code, deleted_at: null },
      });
      if (!system) {
        system = await prisma.system.create({
          data: {
            organization_id: orgId,
            site_id: siteId,
            unit_id: unit.id,
            name: s.name,
            code: s.code,
            status: 'Active',
          },
        });
        stats.systems++;
      }
      for (const a of s.assets) {
        const tag = `${siteCode}-${a.tag}`;
        const existing = await prisma.asset.findFirst({
          where: { organization_id: orgId, tag_number: tag, deleted_at: null },
        });
        if (!existing) {
          await prisma.asset.create({
            data: {
              organization_id: orgId,
              site_id: siteId,
              plant_id: plant.id,
              unit_id: unit.id,
              system_id: system.id,
              tag_number: tag,
              name: a.name,
              asset_type: a.type,
              is_active: true,
            },
          });
          stats.assets++;
        }
      }
    }
  }
}

async function seedTenants() {
  console.log('\n── Tenants ──');
  for (const t of DEMO_TENANTS) {
    let org = await prisma.organization.findFirst({
      where: { slug: t.slug, deleted_at: null },
    });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          id: randomUUID(),
          name: t.name,
          slug: t.slug,
          industry: t.industry,
          country: t.country,
          tenant_type: t.tenant_type,
          is_active: true,
          updated_at: new Date(),
        },
      });
      stats.tenants++;
    } else {
      org = await prisma.organization.update({
        where: { id: org.id },
        data: {
          name: t.name,
          industry: t.industry,
          country: t.country,
          tenant_type: t.tenant_type,
          is_active: true,
        },
      });
    }
    console.log(`  · ${t.name}`);

    // Strip platform roles if any
    const rogue = await prisma.role.findMany({
      where: { organization_id: org.id, slug: { startsWith: 'platform_' } },
    });
    for (const r of rogue) {
      await prisma.userRole.deleteMany({ where: { role_id: r.id } });
      await prisma.role.delete({ where: { id: r.id } });
    }

    let siteId: string | null = null;
    if (t.site) {
      let site = await prisma.site.findFirst({
        where: { organization_id: org.id, code: t.site.code, deleted_at: null },
      });
      if (!site) {
        site = await prisma.site.create({
          data: {
            organization_id: org.id,
            name: t.site.name,
            code: t.site.code,
            is_active: true,
          },
        });
        stats.sites++;
      } else {
        site = await prisma.site.update({
          where: { id: site.id },
          data: { name: t.site.name },
        });
      }
      siteId = site.id;
      const isRefinery = t.tenant_type === 'Refinery Owner';
      await seedHierarchy(org.id, site.id, t.site.code, isRefinery);
    }

    const roleIds: Record<string, string> = {};
    for (const r of TENANT_DEMO_ROLES) {
      roleIds[r.slug] = await upsertRole(org.id, r.slug, r.name);
    }

    for (const r of TENANT_DEMO_ROLES) {
      const email = `${r.localPart}@${t.emailDomain}`;
      const personName = `${r.name} (${t.slug.toUpperCase()})`;
      await upsertUser({
        orgId: org.id,
        siteId,
        email,
        name: personName,
        position: r.name,
        roleId: roleIds[r.slug],
        isTenantAdmin: r.slug === 'tenant_administrator',
      });
    }
  }
}

async function seedPlatformLibrary(platformOrgId: string, adminUserId: string) {
  console.log('\n── Platform Standard Library ──');

  // Disciplines
  const discIds: Record<string, string> = {};
  for (const d of DISCIPLINES) {
    let row = await prisma.discipline.findFirst({
      where: { organization_id: platformOrgId, code: d.code },
    });
    if (!row) {
      row = await prisma.discipline.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrgId,
          name: d.name,
          code: d.code,
          is_active: true,
          updated_at: new Date(),
        },
      });
      stats.disciplines++;
    }
    discIds[d.code] = row.id;
  }

  // Equipment types
  for (const et of buildEquipmentTypes()) {
    const exists = await prisma.equipmentType.findFirst({
      where: { org_id: platformOrgId, code: et.code },
    });
    if (!exists) {
      await prisma.equipmentType.create({
        data: {
          id: randomUUID(),
          org_id: platformOrgId,
          name: et.name,
          code: et.code,
          description: et.description,
          is_active: true,
        },
      });
      stats.equipmentTypes++;
    }
  }
  console.log(`  · Equipment types: +${stats.equipmentTypes}`);

  // M8.13 — Standard Activity Types (seed after equipment types exist)
  const equipmentTypeMap = new Map<string, string>();
  const allEqTypes = await prisma.equipmentType.findMany({ where: { org_id: platformOrgId } });
  for (const eq of allEqTypes) {
    if (eq.code) equipmentTypeMap.set(eq.code, eq.id);
  }
  const satRecords = buildStandardActivityTypeSeed(equipmentTypeMap);
  let satCount = 0;
  for (const rec of satRecords) {
    const exists = await prisma.standardActivityType.findFirst({
      where: { equipment_type_id: rec.equipment_type_id, code: rec.code },
    });
    if (!exists) {
      await prisma.standardActivityType.create({ data: rec });
      satCount++;
    }
  }
  console.log(`  · Standard activity types: +${satCount}`);

  // Activity codes
  for (const a of buildActivityCodes()) {
    const exists = await prisma.activityLibrary.findFirst({
      where: { organization_id: platformOrgId, activity_code: a.code, deleted_at: null },
    });
    if (!exists) {
      await prisma.activityLibrary.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrgId,
          name: a.name,
          activity_code: a.code,
          description: a.description,
          duration_hours: a.duration_hours,
          discipline_id: discIds[a.disciplineCode] || null,
          phase: a.phase,
          is_active: true,
          updated_at: new Date(),
        },
      });
      stats.activityCodes++;
    }
  }
  console.log(`  · Activity codes: +${stats.activityCodes}`);

  // Resources
  for (const r of RESOURCE_TYPES) {
    const exists = await prisma.resourceType.findFirst({
      where: { organization_id: platformOrgId, code: r.code },
    });
    if (!exists) {
      await prisma.resourceType.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrgId,
          name: r.name,
          code: r.code,
          discipline_id: discIds[r.discipline] || null,
          is_active: true,
          updated_at: new Date(),
        },
      });
      stats.resourceTypes++;
    }
  }

  // UDFs
  for (const u of buildUdfDefinitions()) {
    const exists = await prisma.activityUdfDefinition.findFirst({
      where: { organization_id: platformOrgId, code: u.code, deleted_at: null },
    });
    if (!exists) {
      await prisma.activityUdfDefinition.create({
        data: {
          id: randomUUID(),
          organization_id: platformOrgId,
          name: u.name,
          code: u.code,
          type: u.type,
          is_active: true,
          updated_at: new Date(),
        },
      });
      stats.udfs++;
    }
  }

  // Certificates
  for (const c of CERTIFICATE_TEMPLATES) {
    const exists = await prisma.certificate_templates.findFirst({
      where: { cert_name: c.cert_name, is_platform: true },
    });
    if (!exists) {
      await prisma.certificate_templates.create({
        data: {
          id: randomUUID(),
          organization_id: null,
          cert_type: c.cert_type,
          cert_name: c.cert_name,
          equipment_types: c.equipment_types,
          fields: [
            { key: 'certificate_number', label: 'Certificate Number', type: 'text' },
            { key: 'equipment_tag', label: 'Equipment Tag', type: 'text' },
            { key: 'tested_by', label: 'Performed By', type: 'text' },
            { key: 'witnessed_by', label: 'Witnessed By', type: 'text' },
            { key: 'test_date', label: 'Date', type: 'date' },
            { key: 'remarks', label: 'Remarks', type: 'textarea' },
          ],
          is_platform: true,
          is_active: true,
          version: 1,
          updated_at: new Date(),
        },
      });
      stats.certificates++;
    }
  }

  // Print presets stored as approved knowledge (print_settings is 1:1 per org)
  stats.printPresets = PRINT_TEMPLATE_PRESETS.length;

  // Workpack templates + activities
  const templates = buildAllTemplates();
  for (const t of templates) {
    let tpl = await prisma.workpack_templates.findFirst({
      where: {
        organization_id: platformOrgId,
        equipment_type: t.equipment_type,
        job_type: t.job_type,
        deleted_at: null,
      },
    });
    if (!tpl) {
      const tplId = randomUUID();
      tpl = await prisma.workpack_templates.create({
        data: {
          id: tplId,
          organization_id: platformOrgId,
          template_family_id: tplId,
          revision: 1,
          version_label: '1.0',
          library_scope: 'PLATFORM',
          lifecycle_status: 'PUBLISHED',
          name: t.name,
          category: 'Turnaround',
          equipment_type: t.equipment_type,
          job_type: t.job_type,
          description: t.description,
          planning_json: { typical_duration_hours: t.activities.reduce((s, a) => s + a.duration_hours, 0) },
          resources_json: [],
          materials_json: [],
          safety_json: { permits: ['Cold Work'], loto: true },
          qaqc_json: { hold_points: t.activities.filter((a) => a.hold_point_type === 'Hold').map((a) => a.description) },
          references_json: [],
          ai_metadata_json: {
            keywords: t.keywords,
            shutdown_type: t.shutdown_type,
            failure_mode: t.failure_mode,
          },
          is_system: true,
          is_active: true,
          published_at: new Date(),
          created_by: adminUserId,
          updated_at: new Date(),
        },
      });
      stats.workpackTemplates++;
      let seq = 1;
      for (const act of t.activities) {
        await prisma.workpack_template_activities.create({
          data: {
            id: randomUUID(),
            organization_id: platformOrgId,
            template_id: tpl.id,
            sequence_number: seq++,
            activity_code: act.activity_code,
            description: act.description,
            duration_hours: act.duration_hours,
            hold_point_type: act.hold_point_type || null,
            updated_at: new Date(),
          },
        });
        stats.templateActivities++;
      }
    }
  }
  console.log(`  · Workpack templates: +${stats.workpackTemplates}`);
}

async function seedKnowledgeEngine(platformOrgId: string) {
  console.log('\n── Knowledge Engine demo ──');
  const existing = await prisma.knowledgeAsset.count();
  if (existing >= 15) {
    console.log(`  · Skipping (already ${existing} assets)`);
    const groups = await prisma.knowledgeAsset.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    for (const g of groups) {
      if (g.status === 'INCOMING') stats.knowledgeIncoming = g._count._all;
      if (g.status === 'APPROVED') stats.knowledgeApproved = g._count._all;
      if (g.status === 'REJECTED') stats.knowledgeRejected = g._count._all;
      if (g.status === 'REVIEW_QUEUE') stats.knowledgeReview = g._count._all;
    }
    return;
  }

  const samples: {
    status: 'INCOMING' | 'REVIEW_QUEUE' | 'APPROVED' | 'REJECTED' | 'AI_ANALYSIS';
    category: 'ACTIVITY_CODE' | 'WORKPACK_TEMPLATE' | 'EQUIPMENT_TYPE' | 'UDF_DEFINITION' | 'RESOURCE_TYPE';
    title: string;
    payload: Record<string, unknown>;
    recommendation?: string;
    suggestion?: string;
    similarity?: number;
  }[] = [
    {
      status: 'INCOMING',
      category: 'ACTIVITY_CODE',
      title: 'Mechanical — Pump Seal Replacement (IOCL variant)',
      payload: { name: 'Pump Seal Replacement', duration_hours: 8, discipline: 'Mechanical' },
      similarity: 0.81,
      recommendation: 'MERGE',
      suggestion: 'Similar to Platform “Replace Mechanical Seal”. Suggest merge.',
    },
    {
      status: 'INCOMING',
      category: 'WORKPACK_TEMPLATE',
      title: 'HEX Bundle Pull — Panipat Practice',
      payload: { name: 'HEX Bundle Pull', equipment_type: 'Shell & Tube Heat Exchanger' },
      similarity: 0.94,
      recommendation: 'DUPLICATE',
      suggestion: 'Near-duplicate of Platform “Heat Exchanger Bundle Pulling”.',
    },
    {
      status: 'REVIEW_QUEUE',
      category: 'EQUIPMENT_TYPE',
      title: 'API 610 OH2 Pump Class',
      payload: { name: 'API 610 OH2 Pump', code: 'PMP-OH2' },
      similarity: 0.62,
      recommendation: 'NEW',
      suggestion: 'No close match. Suggest approve as new equipment type.',
    },
    {
      status: 'REVIEW_QUEUE',
      category: 'UDF_DEFINITION',
      title: 'Flange Management ID',
      payload: { name: 'Flange Management ID', code: 'UDF_FM_ID', type: 'TEXT' },
      similarity: 0.55,
      recommendation: 'NEW',
      suggestion: 'Useful flange integrity field. Suggest approve.',
    },
    {
      status: 'APPROVED',
      category: 'ACTIVITY_CODE',
      title: 'Scaffold Erect — Standard',
      payload: { name: 'Scaffold Erect', duration_hours: 12, discipline: 'Scaffolding' },
      similarity: 0.2,
      recommendation: 'NEW',
      suggestion: 'Approved into Standard Library.',
    },
    {
      status: 'APPROVED',
      category: 'WORKPACK_TEMPLATE',
      title: 'API 610 Pump Overhaul — Standard',
      payload: { name: 'API 610 Pump Overhaul', equipment_type: 'Centrifugal Pump' },
      similarity: 0.15,
      recommendation: 'NEW',
      suggestion: 'Approved platform methodology.',
    },
    {
      status: 'APPROVED',
      category: 'RESOURCE_TYPE',
      title: 'Rigging Crew — Standard',
      payload: { name: 'Rigging Crew', code: 'RES-RIG' },
      recommendation: 'NEW',
      suggestion: 'Approved.',
    },
    {
      status: 'REJECTED',
      category: 'ACTIVITY_CODE',
      title: 'Generic Task Placeholder',
      payload: { name: 'Do something', duration_hours: 1 },
      similarity: 0.05,
      recommendation: 'REJECT',
      suggestion: 'Too vague for Standard Library.',
    },
    {
      status: 'REJECTED',
      category: 'WORKPACK_TEMPLATE',
      title: 'Copy of Template with Site Names',
      payload: { name: 'Panipat CDU Special', site_name: 'stripped' },
      recommendation: 'REJECT',
      suggestion: 'Contained site-specific content after sanitize review.',
    },
    {
      status: 'AI_ANALYSIS',
      category: 'EQUIPMENT_TYPE',
      title: 'Vertical In-line Pump',
      payload: { name: 'Vertical In-line Pump', code: 'PMP-IL' },
      similarity: 0.78,
      recommendation: 'MERGE',
      suggestion: 'Compare with Centrifugal Pump — Vertical variants.',
    },
  ];

  // Extra incoming/review samples for demo volume
  for (let i = 1; i <= 8; i++) {
    samples.push({
      status: i % 2 === 0 ? 'INCOMING' : 'REVIEW_QUEUE',
      category: 'ACTIVITY_CODE',
      title: `Tenant-sourced activity pattern ${i}`,
      payload: { name: `Pattern activity ${i}`, duration_hours: 2 + i },
      similarity: 0.4 + i * 0.05,
      recommendation: i > 5 ? 'MERGE' : 'NEW',
      suggestion: i > 5 ? 'Merge candidate with Standard Library.' : 'Candidate for new activity code.',
    });
  }

  let approvedId: string | null = null;
  for (const s of samples) {
    const hash = createHash('sha256')
      .update(JSON.stringify({ c: s.category, t: s.title, p: s.payload }))
      .digest('hex');
    const row = await prisma.knowledgeAsset.create({
      data: {
        status: s.status,
        category: s.category,
        asset_type: s.category,
        title: s.title,
        content_hash: hash,
        sanitized_payload: s.payload,
        source_industry: 'Oil & Gas',
        source_org_hash: createHash('sha256').update('demo').digest('hex').slice(0, 16),
        similarity_score: s.similarity ?? null,
        ai_recommendation: s.recommendation ?? null,
        ai_suggestion: s.suggestion ?? null,
        matched_asset_id: s.recommendation === 'DUPLICATE' || s.recommendation === 'MERGE' ? approvedId : null,
        times_seen: 1 + Math.floor(Math.random() * 5),
        times_used: Math.floor(Math.random() * 3),
        promoted_at: s.status === 'APPROVED' ? new Date() : null,
        reviewed_at: s.status === 'APPROVED' || s.status === 'REJECTED' ? new Date() : null,
      },
    });
    if (s.status === 'APPROVED' && !approvedId) approvedId = row.id;
    if (s.status === 'INCOMING') stats.knowledgeIncoming++;
    if (s.status === 'APPROVED') stats.knowledgeApproved++;
    if (s.status === 'REJECTED') stats.knowledgeRejected++;
    if (s.status === 'REVIEW_QUEUE') stats.knowledgeReview++;
  }

  // Store print presets as approved knowledge
  for (const p of PRINT_TEMPLATE_PRESETS) {
    const hash = createHash('sha256').update(`print:${p.name}`).digest('hex');
    await prisma.knowledgeAsset.create({
      data: {
        status: 'APPROVED',
        category: 'PRINT_SETTINGS',
        asset_type: 'print_preset',
        title: p.name,
        content_hash: hash,
        sanitized_payload: {
          name: p.name,
          cover_accent_color: p.accent,
          cover_bg_color: p.bg,
        },
        source_industry: 'Oil & Gas',
        ai_recommendation: 'NEW',
        ai_suggestion: 'Platform print preset.',
        promoted_at: new Date(),
        times_used: 1,
      },
    });
    stats.knowledgeApproved++;
  }
}

async function main() {
  console.log('🏭 M5.4 Enterprise Demo Environment seed');
  const { org: platformOrg, adminUserId } = await seedPlatform();
  await seedTenants();
  await seedPlatformLibrary(platformOrg.id, adminUserId);
  await seedKnowledgeEngine(platformOrg.id);

  // Totals from DB for report accuracy
  const [
    orgCount,
    userCount,
    roleCount,
    siteCount,
    plantCount,
    areaCount,
    unitCount,
    systemCount,
    assetCount,
    eqCount,
    actCount,
    tplCount,
    keCount,
  ] = await Promise.all([
    prisma.organization.count({ where: { deleted_at: null } }),
    prisma.user.count({ where: { deleted_at: null } }),
    prisma.role.count(),
    prisma.site.count({ where: { deleted_at: null } }),
    prisma.plant.count({ where: { deleted_at: null } }),
    prisma.area.count({ where: { deleted_at: null } }),
    prisma.unit.count({ where: { deleted_at: null } }),
    prisma.system.count({ where: { deleted_at: null } }),
    prisma.asset.count({ where: { deleted_at: null } }),
    prisma.equipmentType.count({ where: { org_id: platformOrg.id } }),
    prisma.activityLibrary.count({ where: { organization_id: platformOrg.id, deleted_at: null } }),
    prisma.workpack_templates.count({ where: { organization_id: platformOrg.id, deleted_at: null } }),
    prisma.knowledgeAsset.count(),
  ]);

  console.log('\n══════════════════════════════════════');
  console.log('SEED REPORT (DB totals)');
  console.log('══════════════════════════════════════');
  console.log(`Organizations:        ${orgCount}`);
  console.log(`Users:                ${userCount}`);
  console.log(`Roles:                ${roleCount}`);
  console.log(`Sites:                ${siteCount}`);
  console.log(`Plants:               ${plantCount}`);
  console.log(`Areas:                ${areaCount}`);
  console.log(`Units:                ${unitCount}`);
  console.log(`Systems:              ${systemCount}`);
  console.log(`Assets:               ${assetCount}`);
  console.log(`Equipment Types:      ${eqCount}`);
  console.log(`Activity Codes:       ${actCount}`);
  console.log(`Workpack Templates:   ${tplCount}`);
  console.log(`Knowledge Assets:     ${keCount}`);
  console.log(`Password (all users): ${PASSWORD}`);
  console.log('══════════════════════════════════════');
  console.log('Example logins:');
  console.log('  info@syority.com / Admin@123');
  console.log('  admin@iocl.test / Admin@123');
  console.log('  lead.planner@hmel.test / Admin@123');
  console.log('  mech.eng@ril.test / Admin@123');
}

main()
  .then(() => disconnect())
  .catch(async (e) => {
    console.error(e);
    await disconnect();
    process.exit(1);
  });
