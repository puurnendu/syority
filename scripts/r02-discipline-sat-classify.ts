/**
 * Read-only classification of live Activity discipline / SAT derivability.
 * Does not UPDATE any row.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { prisma, disconnect } from '../prisma/seed-client';

type Class =
  | 'AUTO_SAFE'
  | 'DERIVABLE_AFTER_MASTER_MAPPING'
  | 'AMBIGUOUS'
  | 'INSUFFICIENT_DATA';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG_RE = /^([A-Z]{1,4}-\d+[A-Z]?)\s+(.+)$/i;
const LIBRARY_CODE = /^ACT[-_]/i;

function worse(a: Class, b: Class): Class {
  const rank: Record<Class, number> = {
    AUTO_SAFE: 0,
    DERIVABLE_AFTER_MASTER_MAPPING: 1,
    AMBIGUOUS: 2,
    INSUFFICIENT_DATA: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

function overall(disc: Class, sat: Class): Class {
  if (disc === 'AUTO_SAFE' && sat === 'AUTO_SAFE') return 'AUTO_SAFE';
  if (disc === 'AMBIGUOUS' || sat === 'AMBIGUOUS') return 'AMBIGUOUS';
  if (disc === 'DERIVABLE_AFTER_MASTER_MAPPING' || sat === 'DERIVABLE_AFTER_MASTER_MAPPING') {
    return 'DERIVABLE_AFTER_MASTER_MAPPING';
  }
  return 'INSUFFICIENT_DATA';
}

async function main() {
  const activities = await prisma.$queryRaw<Array<{
    id: string;
    organization_id: string;
    workpack_id: string | null;
    event_id: string | null;
    activity_library_id: string | null;
    activity_number: string | null;
    description: string;
    work_category: string | null;
    discipline_id: string | null;
    standard_activity_type_id: string | null;
    wp_number: string | null;
    wp_title: string | null;
    wp_discipline: string | null;
    wp_eq: string | null;
    wp_template: string | null;
    wp_asset: string | null;
    ev_discipline: string | null;
  }>>`
    SELECT
      a.id, a.organization_id, a.workpack_id, a.event_id, a.activity_library_id,
      a.activity_number, a.description, a.work_category,
      a.discipline_id, a.standard_activity_type_id,
      w.workpack_number AS wp_number, w.title AS wp_title,
      w.discipline_id AS wp_discipline, w.equipment_type AS wp_eq,
      w.template_id AS wp_template, w.asset_id AS wp_asset,
      e.discipline_id AS ev_discipline
    FROM "Activity" a
    LEFT JOIN "Workpack" w ON w.id = a.workpack_id
    LEFT JOIN events e ON e.id = a.event_id
    WHERE a.deleted_at IS NULL
    ORDER BY a.organization_id, w.workpack_number, a.activity_number, a.id
  `;

  const disciplines = await prisma.$queryRaw<Array<{
    id: string; organization_id: string; code: string; name: string;
  }>>`
    SELECT id, organization_id, code, name
    FROM "Discipline"
    WHERE COALESCE(is_active, true) = true
  `;

  const libraries = await prisma.$queryRaw<Array<{
    id: string; organization_id: string; activity_code: string | null;
    name: string; discipline_id: string | null;
  }>>`
    SELECT id, organization_id, activity_code, name, discipline_id
    FROM "ActivityLibrary"
    WHERE deleted_at IS NULL AND COALESCE(is_active, true) = true
      AND activity_code IS NOT NULL
  `;

  const sats = await prisma.$queryRaw<Array<{
    id: string; organization_id: string | null; equipment_type_id: string;
    code: string; name: string;
  }>>`
    SELECT id, organization_id, equipment_type_id, code, name
    FROM standard_activity_types
    WHERE is_active = true
  `;

  const assets = await prisma.$queryRaw<Array<{
    id: string; organization_id: string; tag_number: string | null; equipment_type_id: string | null;
  }>>`
    SELECT id, organization_id, tag_number, equipment_type_id
    FROM "Asset"
    WHERE COALESCE(is_active, true) = true
  `;

  const eqTypes = await prisma.$queryRaw<Array<{ id: string; org_id: string; code: string | null; name: string }>>`
    SELECT id, org_id, code, name FROM "EquipmentType" WHERE is_active = true
  `;

  const discByOrg = new Map<string, typeof disciplines>();
  for (const d of disciplines) {
    const list = discByOrg.get(d.organization_id) ?? [];
    list.push(d);
    discByOrg.set(d.organization_id, list);
  }

  const libByOrgCode = new Map<string, typeof libraries>();
  for (const l of libraries) {
    const key = `${l.organization_id}::${(l.activity_code ?? '').toLowerCase()}`;
    const list = libByOrgCode.get(key) ?? [];
    list.push(l);
    libByOrgCode.set(key, list);
  }

  const satByCode = new Map<string, typeof sats>();
  const satByName = new Map<string, typeof sats>();
  for (const s of sats) {
    const ck = s.code.toLowerCase();
    const nk = s.name.toLowerCase();
    satByCode.set(ck, [...(satByCode.get(ck) ?? []), s]);
    satByName.set(nk, [...(satByName.get(nk) ?? []), s]);
  }

  const assetsByOrgTag = new Map<string, typeof assets>();
  for (const a of assets) {
    if (!a.tag_number) continue;
    const key = `${a.organization_id}::${a.tag_number.toLowerCase()}`;
    assetsByOrgTag.set(key, [...(assetsByOrgTag.get(key) ?? []), a]);
  }

  const rows = activities.map((a) => classifyOne(a, {
    discByOrg,
    libByOrgCode,
    satByCode,
    satByName,
    assetsByOrgTag,
    eqTypes,
  }));

  const summary = {
    read_only: true,
    database: 'syority',
    live_activities: rows.length,
    row_class_counts: count(rows, (r) => r.row_class),
    discipline_class_counts: count(rows, (r) => r.discipline.class),
    sat_class_counts: count(rows, (r) => r.sat.class),
    auto_safe_now: rows.filter((r) => r.row_class === 'AUTO_SAFE').length,
    orgs_with_discipline_master: discByOrg.size,
    orgs_represented: [...new Set(activities.map((a) => a.organization_id))].length,
    catalog: {
      disciplines: disciplines.length,
      libraries_with_code: libraries.length,
      sats: sats.length,
      templates_on_workpacks: activities.filter((a) => a.wp_template).length,
      library_fk_on_activities: activities.filter((a) => a.activity_library_id).length,
      workpack_discipline_set: activities.filter((a) => a.wp_discipline).length,
      workpack_equipment_type_set: activities.filter((a) => a.wp_eq).length,
    },
    rows,
  };

  const dir = join(process.cwd(), 'var', 'r02-identity-backfill');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'discipline-sat-candidate-mapping.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({
    live: rows.length,
    row_class_counts: summary.row_class_counts,
    discipline_class_counts: summary.discipline_class_counts,
    sat_class_counts: summary.sat_class_counts,
    catalog: summary.catalog,
    orgs_with_discipline_master: discByOrg.size,
    derivable_rows: rows.filter((r) => r.row_class === 'DERIVABLE_AFTER_MASTER_MAPPING').map((r) => ({
      id: r.activity_id,
      desc: r.description,
      number: r.activity_number,
      disc: r.discipline,
      sat: r.sat,
    })),
    ambiguous_rows: rows.filter((r) => r.row_class === 'AMBIGUOUS').map((r) => ({
      id: r.activity_id,
      desc: r.description,
      number: r.activity_number,
      disc: r.discipline,
      sat: r.sat,
    })),
    persisted: join(dir, 'discipline-sat-candidate-mapping.json'),
  }, null, 2));
}

function classifyOne(
  a: {
    id: string;
    organization_id: string;
    workpack_id: string | null;
    event_id: string | null;
    activity_library_id: string | null;
    activity_number: string | null;
    description: string;
    work_category: string | null;
    discipline_id: string | null;
    standard_activity_type_id: string | null;
    wp_number: string | null;
    wp_title: string | null;
    wp_discipline: string | null;
    wp_eq: string | null;
    wp_template: string | null;
    wp_asset: string | null;
    ev_discipline: string | null;
  },
  ctx: {
    discByOrg: Map<string, Array<{ id: string; organization_id: string; code: string; name: string }>>;
    libByOrgCode: Map<string, Array<{ id: string; organization_id: string; activity_code: string | null; name: string; discipline_id: string | null }>>;
    satByCode: Map<string, Array<{ id: string; equipment_type_id: string; code: string; name: string }>>;
    satByName: Map<string, Array<{ id: string; equipment_type_id: string; code: string; name: string }>>;
    assetsByOrgTag: Map<string, Array<{ id: string; tag_number: string | null; equipment_type_id: string | null }>>;
    eqTypes: Array<{ id: string; org_id: string; code: string | null; name: string }>;
  }
) {
  const orgDiscs = ctx.discByOrg.get(a.organization_id) ?? [];
  const number = a.activity_number?.trim() || null;
  const desc = a.description.trim();

  const discipline = classifyDiscipline(a, number, orgDiscs, ctx.libByOrgCode);
  const sat = classifySat(a, number, desc, ctx);

  return {
    activity_id: a.id,
    organization_id: a.organization_id,
    workpack_id: a.workpack_id,
    workpack_number: a.wp_number,
    workpack_title: a.wp_title,
    event_id: a.event_id,
    activity_number: number,
    description: desc,
    work_category: a.work_category,
    existing_discipline_id: a.discipline_id,
    existing_sat_id: a.standard_activity_type_id,
    discipline,
    sat,
    row_class: overall(discipline.class, sat.class),
  };
}

function classifyDiscipline(
  a: {
    organization_id: string;
    discipline_id: string | null;
    activity_library_id: string | null;
    wp_discipline: string | null;
    wp_template: string | null;
    wp_number: string | null;
    wp_title: string | null;
    ev_discipline: string | null;
    work_category: string | null;
  },
  number: string | null,
  orgDiscs: Array<{ id: string; code: string; name: string }>,
  libByOrgCode: Map<string, Array<{ id: string; activity_code: string | null; name: string; discipline_id: string | null }>>
): { class: Class; candidate_id: string | null; candidate_code: string | null; reason: string; mapping_required: string | null } {
  if (a.discipline_id) {
    const hit = orgDiscs.find((d) => d.id === a.discipline_id);
    if (hit) {
      return {
        class: 'AUTO_SAFE',
        candidate_id: hit.id,
        candidate_code: hit.code,
        reason: 'Existing Activity.discipline_id is valid in-tenant.',
        mapping_required: null,
      };
    }
    return {
      class: 'AMBIGUOUS',
      candidate_id: a.discipline_id,
      candidate_code: null,
      reason: 'Existing discipline_id does not resolve in this tenant. Not overwritten.',
      mapping_required: null,
    };
  }

  if (a.wp_discipline) {
    const hit = orgDiscs.find((d) => d.id === a.wp_discipline);
    if (hit) {
      return {
        class: 'AUTO_SAFE',
        candidate_id: hit.id,
        candidate_code: hit.code,
        reason: 'Workpack.discipline_id is unique and tenant-valid (R0.1/R0.2 rule).',
        mapping_required: null,
      };
    }
    return {
      class: 'AMBIGUOUS',
      candidate_id: a.wp_discipline,
      candidate_code: null,
      reason: 'Workpack.discipline_id does not resolve in this tenant.',
      mapping_required: null,
    };
  }

  if (orgDiscs.length === 0) {
    return {
      class: 'INSUFFICIENT_DATA',
      candidate_id: null,
      candidate_code: null,
      reason: 'Tenant has no Discipline master records. Nothing to resolve to.',
      mapping_required: 'Create tenant Discipline catalog before any backfill.',
    };
  }

  if (number && !UUID_RE.test(number)) {
    const libs = libByOrgCode.get(`${a.organization_id}::${number.toLowerCase()}`) ?? [];
    const withDisc = libs.filter((l) => l.discipline_id);
    if (libs.length > 1) {
      return {
        class: 'AMBIGUOUS',
        candidate_id: null,
        candidate_code: null,
        reason: `activity_number "${number}" matches ${libs.length} ActivityLibrary codes in this tenant.`,
        mapping_required: null,
      };
    }
    if (libs.length === 1 && withDisc.length === 1) {
      const disc = orgDiscs.find((d) => d.id === withDisc[0].discipline_id) ?? null;
      if (disc) {
        return {
          class: 'DERIVABLE_AFTER_MASTER_MAPPING',
          candidate_id: disc.id,
          candidate_code: disc.code,
          reason: `activity_number uniquely matches ActivityLibrary "${libs[0].activity_code}" (${libs[0].name}) which has discipline ${disc.code}. Activity.activity_library_id is not set, so R0.2 will not apply this automatically.`,
          mapping_required: `Governed rule: treat unique same-tenant ActivityLibrary.activity_code == Activity.activity_number as the library FK, then copy library.discipline_id. ACT-* remains a library namespace, not a SAT.`,
        };
      }
    }
    if (libs.length === 1 && !withDisc.length) {
      return {
        class: 'INSUFFICIENT_DATA',
        candidate_id: null,
        candidate_code: null,
        reason: `activity_number uniquely matches ActivityLibrary "${libs[0].activity_code}" but that library row has no discipline_id.`,
        mapping_required: 'Populate ActivityLibrary.discipline_id, then link the activity.',
      };
    }
  }

  const title = `${a.wp_number ?? ''} ${a.wp_title ?? ''}`.toUpperCase();
  const prefixHits: Array<{ code: string; via: string }> = [];
  if (/\bWP-MECH\b/.test(title) || title.includes('WP-MECH-')) prefixHits.push({ code: 'MECH', via: 'workpack number WP-MECH' });
  if (/\bWP-PIPE\b/.test(title) || title.includes('WP-PIPE-')) prefixHits.push({ code: 'PIPE', via: 'workpack number WP-PIPE' });
  if (/\bWP-ELEC\b/.test(title) || title.includes('WP-ELEC-')) prefixHits.push({ code: 'ELEC', via: 'workpack number WP-ELEC' });
  if (/\bWP-INST\b/.test(title) || title.includes('WP-INST-')) prefixHits.push({ code: 'INST', via: 'workpack number WP-INST' });
  if (/\bWP-SUPP\b/.test(title) || title.includes('WP-SUPP-')) prefixHits.push({ code: 'SCAF', via: 'workpack number WP-SUPP (scaffolding assumed)' });

  if (prefixHits.length > 0) {
    const resolved = prefixHits.map((h) => ({
      ...h,
      disc: orgDiscs.find((d) => d.code === h.code) ?? null,
    }));
    const uniqueResolved = resolved.filter((h) => h.disc);
    const missing = resolved.filter((h) => !h.disc);
    if (title.includes('ELECTRICAL') && title.includes('INSTRUMENT')) {
      return {
        class: 'AMBIGUOUS',
        candidate_id: null,
        candidate_code: null,
        reason: 'Workpack title names both Electrical and Instrumentation. Two tenant disciplines exist (ELEC, INST).',
        mapping_required: 'Split the workpack or assign per-activity discipline; do not take the first match.',
      };
    }
    if (missing.length && uniqueResolved.length === 0) {
      return {
        class: 'INSUFFICIENT_DATA',
        candidate_id: null,
        candidate_code: null,
        reason: `Workpack code hints ${missing.map((m) => m.code).join(', ')} but this tenant has no such Discipline code. PIPE is not in the catalog.`,
        mapping_required: 'Add the missing Discipline code or an approved WP-prefix → Discipline map.',
      };
    }
    if (uniqueResolved.length === 1 && prefixHits[0].via.includes('WP-SUPP')) {
      return {
        class: 'AMBIGUOUS',
        candidate_id: uniqueResolved[0].disc!.id,
        candidate_code: uniqueResolved[0].disc!.code,
        reason: 'WP-SUPP is not a governed discipline code. Mapping it to SCAF is an assumption (pack also contains crane/milestone/safety work).',
        mapping_required: 'Do not auto-map WP-SUPP. Assign discipline per activity after review.',
      };
    }
    if (uniqueResolved.length === 1) {
      return {
        class: 'DERIVABLE_AFTER_MASTER_MAPPING',
        candidate_id: uniqueResolved[0].disc!.id,
        candidate_code: uniqueResolved[0].disc!.code,
        reason: `Workpack number encodes ${uniqueResolved[0].via} and tenant has exactly one ${uniqueResolved[0].disc!.code} discipline. Current implementation does not parse workpack numbers.`,
        mapping_required: 'Approved workpack-number prefix → Discipline.code map (tenant-scoped, unique).',
      };
    }
  }

  if (a.work_category) {
    return {
      class: 'INSUFFICIENT_DATA',
      candidate_id: null,
      candidate_code: null,
      reason: `work_category "${a.work_category}" is a schedule class (EXECUTION/LOE/MILESTONE), not a Discipline.`,
      mapping_required: null,
    };
  }

  if (a.ev_discipline) {
    const hit = orgDiscs.find((d) => d.id === a.ev_discipline);
    if (hit) {
      return {
        class: 'DERIVABLE_AFTER_MASTER_MAPPING',
        candidate_id: hit.id,
        candidate_code: hit.code,
        reason: 'Event.discipline_id is set and tenant-valid, but R0.1 does not copy event discipline onto Activity.',
        mapping_required: 'Approved Event.discipline_id → Activity.discipline_id rule.',
      };
    }
  }

  return {
    class: 'INSUFFICIENT_DATA',
    candidate_id: null,
    candidate_code: null,
    reason: 'No workpack/template/library/event discipline FK and no unique library code. Free-text description is not used.',
    mapping_required: null,
  };
}

function classifySat(
  a: {
    organization_id: string;
    standard_activity_type_id: string | null;
    activity_library_id: string | null;
    wp_eq: string | null;
    wp_asset: string | null;
  },
  number: string | null,
  desc: string,
  ctx: {
    satByCode: Map<string, Array<{ id: string; equipment_type_id: string; code: string; name: string }>>;
    satByName: Map<string, Array<{ id: string; equipment_type_id: string; code: string; name: string }>>;
    assetsByOrgTag: Map<string, Array<{ id: string; tag_number: string | null; equipment_type_id: string | null }>>;
    eqTypes: Array<{ id: string; org_id: string; code: string | null; name: string }>;
    libByOrgCode: Map<string, Array<{ id: string; activity_code: string | null; name: string; discipline_id: string | null }>>;
  }
): {
  class: Class;
  candidate_id: string | null;
  candidate_code: string | null;
  candidate_name: string | null;
  equipment_type_id: string | null;
  reason: string;
  mapping_required: string | null;
} {
  if (a.standard_activity_type_id) {
    return {
      class: 'AUTO_SAFE',
      candidate_id: a.standard_activity_type_id,
      candidate_code: null,
      candidate_name: null,
      equipment_type_id: null,
      reason: 'Existing SAT FK present (validity checked only if resolver used).',
      mapping_required: null,
    };
  }

  if (number && LIBRARY_CODE.test(number)) {
    const libs = ctx.libByOrgCode.get(`${a.organization_id}::${number.toLowerCase()}`) ?? [];
    return {
      class: libs.length > 1 ? 'AMBIGUOUS' : 'INSUFFICIENT_DATA',
      candidate_id: null,
      candidate_code: null,
      candidate_name: null,
      equipment_type_id: null,
      reason: libs.length
        ? `activity_number "${number}" is an Activity Library code (ACT-*), not a Standard Activity Type. R0.1/R0.2 forbid mapping library codes to SAT. Library hits=${libs.length}.`
        : `activity_number "${number}" looks like a library code (ACT-*) and is not a SAT code.`,
      mapping_required: libs.length === 1
        ? 'Optional later: an explicit Library.activity_code → SAT.code table. Do not infer from the ACT-* string.'
        : null,
    };
  }

  if (number && !UUID_RE.test(number)) {
    const byCode = ctx.satByCode.get(number.toLowerCase()) ?? [];
    if (byCode.length > 1) {
      return {
        class: 'AMBIGUOUS',
        candidate_id: null,
        candidate_code: number,
        candidate_name: null,
        equipment_type_id: null,
        reason: `activity_number "${number}" matches ${byCode.length} SAT rows across equipment types.`,
        mapping_required: 'Need unique equipment type before SAT code can be applied.',
      };
    }
    if (byCode.length === 1) {
      return {
        class: 'DERIVABLE_AFTER_MASTER_MAPPING',
        candidate_id: byCode[0].id,
        candidate_code: byCode[0].code,
        candidate_name: byCode[0].name,
        equipment_type_id: byCode[0].equipment_type_id,
        reason: `activity_number uniquely equals SAT code ${byCode[0].code}. No equipment type is on the workpack; CVR still requires equipment type at write time.`,
        mapping_required: 'Attach equipment type (asset or workpack.equipment_type), then ControlledValueResolver.resolveStandardActivity.',
      };
    }
  }

  const tagMatch = desc.match(TAG_RE);
  const remainder = tagMatch ? tagMatch[2].trim() : desc;
  const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
  const assets = tag
    ? (ctx.assetsByOrgTag.get(`${a.organization_id}::${tag.toLowerCase()}`) ?? [])
    : [];

  const nameHits = ctx.satByName.get(remainder.toLowerCase()) ?? [];
  if (nameHits.length > 1) {
    return {
      class: 'AMBIGUOUS',
      candidate_id: null,
      candidate_code: null,
      candidate_name: remainder,
      equipment_type_id: assets[0]?.equipment_type_id ?? null,
      reason: `Description remainder "${remainder}" matches SAT name on ${nameHits.length} equipment types (${[...new Set(nameHits.map((s) => s.code))].join(', ')}).`,
      mapping_required: 'Unique equipment type + approved description→SAT-name map.',
    };
  }
  if (nameHits.length === 1) {
    const eqOk = assets.length === 1 && assets[0].equipment_type_id === nameHits[0].equipment_type_id;
    if (!eqOk) {
      return {
        class: 'INSUFFICIENT_DATA',
        candidate_id: null,
        candidate_code: nameHits[0].code,
        candidate_name: nameHits[0].name,
        equipment_type_id: nameHits[0].equipment_type_id,
        reason: `Remainder "${remainder}" equals SAT name "${nameHits[0].name}" once in the catalog, but SAT is scoped to equipment type ${nameHits[0].equipment_type_id}. No workpack/asset equipment type exists to prove that is the correct SAT. Unique name across all equipment types is not a governed resolution.`,
        mapping_required: 'Link a unique asset/equipment type first. Do not apply a catalog-wide SAT name.',
      };
    }
    return {
      class: 'DERIVABLE_AFTER_MASTER_MAPPING',
      candidate_id: nameHits[0].id,
      candidate_code: nameHits[0].code,
      candidate_name: nameHits[0].name,
      equipment_type_id: nameHits[0].equipment_type_id,
      reason: `Remainder "${remainder}" uniquely matches SAT "${nameHits[0].code}" and tag ${tag} uniquely matches an asset of that equipment type. Current resolver does not parse descriptions.`,
      mapping_required: 'Approved description-remainder → SAT.name map (unique names only) plus asset tag already present.',
    };
  }

  if (tag && assets.length > 1) {
    return {
      class: 'AMBIGUOUS',
      candidate_id: null,
      candidate_code: null,
      candidate_name: null,
      equipment_type_id: null,
      reason: `Tag ${tag} matches ${assets.length} assets in this tenant.`,
      mapping_required: null,
    };
  }

  if (a.wp_eq) {
    const eqs = ctx.eqTypes.filter(
      (e) => e.id === a.wp_eq || (e.code && e.code.toLowerCase() === a.wp_eq!.toLowerCase())
    );
    if (eqs.length > 1) {
      return {
        class: 'AMBIGUOUS',
        candidate_id: null,
        candidate_code: null,
        candidate_name: null,
        equipment_type_id: null,
        reason: 'Workpack.equipment_type matches multiple EquipmentType rows.',
        mapping_required: null,
      };
    }
  }

  return {
    class: 'INSUFFICIENT_DATA',
    candidate_id: null,
    candidate_code: null,
    candidate_name: null,
    equipment_type_id: null,
    reason: number && UUID_RE.test(number)
      ? 'activity_number is a UUID, not a library or SAT code. Description does not exactly equal a unique SAT name.'
      : 'No SAT FK, no library SAT code, no unique SAT code/name, no equipment type on workpack/asset. Description/work_category/WBS are not SAT identifiers.',
    mapping_required: null,
  };
}

function count<T>(rows: T[], fn: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(fn(r), (m.get(fn(r)) ?? 0) + 1);
  return Object.fromEntries(m);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
