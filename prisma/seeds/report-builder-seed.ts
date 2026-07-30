/**
 * M7.6A — Report Builder Seed Data
 *
 * Seeds 5 categories, 15 parameters, 30 report definitions with sections,
 * and 1 default layout.
 *
 * Run: npx ts-node prisma/seeds/report-builder-seed.ts
 * Or import into main seed file.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Categories ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Planning', slug: 'planning', icon: '📋', description: 'Planning and scheduling reports', sort_order: 1 },
  { name: 'Shutdown', slug: 'shutdown', icon: '🔧', description: 'Shutdown scope and execution reports', sort_order: 2 },
  { name: 'Execution', slug: 'execution', icon: '⚡', description: 'Field execution and progress reports', sort_order: 3 },
  { name: 'Management', slug: 'management', icon: '📊', description: 'Executive and management reports', sort_order: 4 },
  { name: 'Platform', slug: 'platform', icon: '🏢', description: 'Platform administration reports', sort_order: 5 },
];

// ─── Parameters ─────────────────────────────────────────────────────────────

const PARAMETERS = [
  { key: 'site', name: 'Site', param_type: 'select', options_source: 'Site', sort_order: 1 },
  { key: 'unit', name: 'Unit', param_type: 'select', options_source: 'Unit', sort_order: 2 },
  { key: 'area', name: 'Area', param_type: 'select', options_source: 'Area', sort_order: 3 },
  { key: 'system', name: 'System', param_type: 'select', options_source: 'System', sort_order: 4 },
  { key: 'event', name: 'Event', param_type: 'select', options_source: 'Event', sort_order: 5 },
  { key: 'contractor', name: 'Contractor', param_type: 'select', options_source: 'Contractor', sort_order: 6 },
  { key: 'discipline', name: 'Discipline', param_type: 'select', options_source: 'Discipline', sort_order: 7 },
  { key: 'date_from', name: 'Date From', param_type: 'date', sort_order: 8 },
  { key: 'date_to', name: 'Date To', param_type: 'date', sort_order: 9 },
  { key: 'status', name: 'Status', param_type: 'select', options_static: [
    { value: 'draft', label: 'Draft' }, { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' }, { value: 'on_hold', label: 'On Hold' },
  ], sort_order: 10 },
  { key: 'scope_id', name: 'Shutdown Scope', param_type: 'select', sort_order: 11 },
  { key: 'shift', name: 'Shift', param_type: 'select', options_static: [
    { value: 'day', label: 'Day Shift' }, { value: 'night', label: 'Night Shift' },
    { value: 'all', label: 'All Shifts' },
  ], sort_order: 12 },
  { key: 'priority', name: 'Priority', param_type: 'select', options_static: [
    { value: 'Critical', label: 'Critical' }, { value: 'High', label: 'High' },
    { value: 'Normal', label: 'Normal' }, { value: 'Low', label: 'Low' },
  ], sort_order: 13 },
  { key: 'work_type', name: 'Work Type', param_type: 'select', options_source: 'WorkType', sort_order: 14 },
  { key: 'include_completed', name: 'Include Completed', param_type: 'boolean', default_value: 'false', sort_order: 15 },
];

// ─── Report Definitions ─────────────────────────────────────────────────────

type DefSeed = {
  slug: string; name: string; category: string; data_source_key: string;
  description: string; supports_ai_summary?: boolean;
  subject_template?: string; filename_template?: string;
  params?: string[]; sections: Array<{ key: string; name: string; type?: string; is_required?: boolean; is_default?: boolean }>;
};

const DEFINITIONS: DefSeed[] = [
  // ── Planning (5) ────────────────────────────────────────────────────────────
  { slug: 'lookahead-24h', name: '24 Hour Look Ahead', category: 'planning', data_source_key: 'planning.lookahead_24h',
    description: 'Activities starting within the next 24 hours. Used for daily planning meetings.',
    subject_template: '24h Look Ahead — {{date}}', filename_template: 'lookahead_24h_{{date}}.pdf',
    supports_ai_summary: true, params: ['site', 'unit', 'event', 'contractor', 'discipline'],
    sections: [
      { key: 'kpis', name: 'Activity Summary', type: 'kpi_cards', is_required: true },
      { key: 'activity_list', name: 'Activity List', type: 'data', is_required: true },
    ] },
  { slug: 'lookahead-72h', name: '72 Hour Look Ahead', category: 'planning', data_source_key: 'planning.lookahead_72h',
    description: 'Activities starting within the next 72 hours. Used for short-term planning.',
    subject_template: '72h Look Ahead — {{date}}', filename_template: 'lookahead_72h_{{date}}.pdf',
    supports_ai_summary: true, params: ['site', 'unit', 'event', 'contractor', 'discipline'],
    sections: [
      { key: 'kpis', name: 'Summary', type: 'kpi_cards', is_required: true },
      { key: 'activity_list', name: 'Activity List', type: 'data', is_required: true },
    ] },
  { slug: 'constraint-register', name: 'Constraint Register', category: 'planning', data_source_key: 'planning.constraint_register',
    description: 'All constraints with status tracking.',
    subject_template: 'Constraint Register — {{date}}', filename_template: 'constraints_{{date}}.pdf',
    params: ['site', 'event', 'status'],
    sections: [
      { key: 'kpis', name: 'Summary', type: 'kpi_cards' },
      { key: 'constraint_list', name: 'Constraints', type: 'data', is_required: true },
    ] },
  { slug: 'critical-path-summary', name: 'Critical Path Summary', category: 'planning', data_source_key: 'planning.critical_path_summary',
    description: 'All activities on the critical path with float analysis.',
    subject_template: 'Critical Path — {{date}}', filename_template: 'critical_path_{{date}}.pdf',
    supports_ai_summary: true, params: ['site', 'event'],
    sections: [
      { key: 'kpis', name: 'Critical Summary', type: 'kpi_cards', is_required: true },
      { key: 'critical_list', name: 'Critical Activities', type: 'data', is_required: true },
    ] },
  { slug: 'workpack-readiness', name: 'Workpack Readiness', category: 'planning', data_source_key: 'planning.workpack_readiness',
    description: 'Readiness scores and status for all workpacks.',
    subject_template: 'Workpack Readiness — {{date}}', filename_template: 'wp_readiness_{{date}}.pdf',
    params: ['site', 'unit', 'event', 'contractor', 'discipline'],
    sections: [
      { key: 'kpis', name: 'Summary', type: 'kpi_cards' },
      { key: 'workpack_list', name: 'Workpacks', type: 'data', is_required: true },
    ] },
  // ── Shutdown (7) ────────────────────────────────────────────────────────────
  { slug: 'scope-register', name: 'Scope Register', category: 'shutdown', data_source_key: 'shutdown.scope_register',
    description: 'Complete scope register with all items, status, and estimated hours.',
    subject_template: 'Scope Register — {{date}}', filename_template: 'scope_register_{{date}}.pdf',
    params: ['scope_id', 'discipline', 'priority'],
    sections: [
      { key: 'kpis', name: 'Scope Summary', type: 'kpi_cards' },
      { key: 'scope_items', name: 'Scope Items', type: 'data', is_required: true },
    ] },
  { slug: 'scope-change-register', name: 'Scope Change Register', category: 'shutdown', data_source_key: 'shutdown.scope_change_register',
    description: 'All scope change requests with approval status.',
    subject_template: 'Scope Changes — {{date}}', filename_template: 'scope_changes_{{date}}.pdf',
    params: ['scope_id', 'status'],
    sections: [
      { key: 'kpis', name: 'Change Summary', type: 'kpi_cards' },
      { key: 'change_list', name: 'Change Requests', type: 'data', is_required: true },
    ] },
  { slug: 'deferred-scope', name: 'Deferred Scope', category: 'shutdown', data_source_key: 'shutdown.deferred_scope',
    description: 'All deferred scope items with carry-forward tracking.',
    subject_template: 'Deferred Scope — {{date}}', filename_template: 'deferred_scope_{{date}}.pdf',
    params: ['scope_id'],
    sections: [
      { key: 'kpis', name: 'Deferral Summary', type: 'kpi_cards' },
      { key: 'deferral_list', name: 'Deferred Items', type: 'data', is_required: true },
    ] },
  { slug: 'shutdown-workpack-status', name: 'Workpack Status', category: 'shutdown', data_source_key: 'shutdown.workpack_status',
    description: 'Workpack status breakdown for shutdown execution.',
    subject_template: 'Workpack Status — {{date}}', filename_template: 'wp_status_{{date}}.pdf',
    params: ['site', 'event', 'contractor'],
    sections: [
      { key: 'kpis', name: 'Status Summary', type: 'kpi_cards' },
      { key: 'workpack_list', name: 'Workpacks', type: 'data', is_required: true },
    ] },
  { slug: 'unit-progress', name: 'Unit Progress', category: 'shutdown', data_source_key: 'shutdown.unit_progress',
    description: 'Progress by unit — planned vs actual.',
    subject_template: 'Unit Progress — {{date}}', filename_template: 'unit_progress_{{date}}.pdf',
    params: ['site', 'event'],
    sections: [
      { key: 'progress_table', name: 'Unit Progress', type: 'data', is_required: true },
    ] },
  { slug: 'contractor-progress', name: 'Contractor Progress', category: 'shutdown', data_source_key: 'shutdown.contractor_progress',
    description: 'Progress by contractor — workpack counts and average completion.',
    subject_template: 'Contractor Progress — {{date}}', filename_template: 'contractor_progress_{{date}}.pdf',
    params: ['site', 'event'],
    sections: [
      { key: 'contractor_table', name: 'Contractor Progress', type: 'data', is_required: true },
    ] },
  { slug: 'discipline-progress', name: 'Discipline Progress', category: 'shutdown', data_source_key: 'shutdown.discipline_progress',
    description: 'Progress by discipline — workpack counts and average completion.',
    subject_template: 'Discipline Progress — {{date}}', filename_template: 'discipline_progress_{{date}}.pdf',
    params: ['site', 'event'],
    sections: [
      { key: 'discipline_table', name: 'Discipline Progress', type: 'data', is_required: true },
    ] },
  // ── Execution (6) ──────────────────────────────────────────────────────────
  { slug: 'shift-progress', name: 'Shift Progress Report', category: 'execution', data_source_key: 'execution.shift_progress',
    description: 'Activities progressed during the current shift (last 12 hours).',
    subject_template: 'Shift Progress — {{date}}', filename_template: 'shift_progress_{{date}}.pdf',
    supports_ai_summary: true, params: ['site', 'unit', 'event', 'shift'],
    sections: [
      { key: 'kpis', name: 'Shift Summary', type: 'kpi_cards' },
      { key: 'progress_list', name: 'Progress Updates', type: 'data', is_required: true },
    ] },
  { slug: 'daily-progress', name: 'Daily Progress Report', category: 'execution', data_source_key: 'execution.daily_progress',
    description: "All progress updates recorded today.",
    subject_template: 'Daily Progress — {{date}}', filename_template: 'daily_progress_{{date}}.pdf',
    supports_ai_summary: true, params: ['site', 'unit', 'event'],
    sections: [
      { key: 'kpis', name: 'Daily Summary', type: 'kpi_cards' },
      { key: 'progress_list', name: 'Progress Updates', type: 'data', is_required: true },
    ] },
  { slug: 'delay-register', name: 'Delay Register', category: 'execution', data_source_key: 'execution.delay_register',
    description: 'Activities past their late finish date — delayed work.',
    subject_template: 'Delay Register — {{date}}', filename_template: 'delays_{{date}}.pdf',
    supports_ai_summary: true, params: ['site', 'event'],
    sections: [
      { key: 'kpis', name: 'Delay Summary', type: 'kpi_cards', is_required: true },
      { key: 'delay_list', name: 'Delayed Activities', type: 'data', is_required: true },
    ] },
  { slug: 'qa-pending', name: 'QA Pending', category: 'execution', data_source_key: 'execution.qa_pending',
    description: 'QA checks awaiting clearance.',
    subject_template: 'QA Pending — {{date}}', filename_template: 'qa_pending_{{date}}.pdf',
    params: ['site'],
    sections: [
      { key: 'kpis', name: 'QA Summary', type: 'kpi_cards' },
      { key: 'qa_list', name: 'Pending QA Checks', type: 'data', is_required: true },
    ] },
  { slug: 'certificate-status', name: 'Certificate Status', category: 'execution', data_source_key: 'execution.certificate_status',
    description: 'Certificates by type and status.',
    subject_template: 'Certificates — {{date}}', filename_template: 'certificates_{{date}}.pdf',
    params: ['site'],
    sections: [
      { key: 'kpis', name: 'Certificate Summary', type: 'kpi_cards' },
      { key: 'cert_list', name: 'Certificates', type: 'data', is_required: true },
    ] },
  { slug: 'punch-register', name: 'Punch List Register', category: 'execution', data_source_key: 'execution.punch_register',
    description: 'All punch items by category, status, and priority.',
    subject_template: 'Punch Register — {{date}}', filename_template: 'punch_register_{{date}}.pdf',
    params: ['site', 'event', 'status', 'priority'],
    sections: [
      { key: 'kpis', name: 'Punch Summary', type: 'kpi_cards' },
      { key: 'punch_list', name: 'Punch Items', type: 'data', is_required: true },
    ] },
  // ── Management (7) ─────────────────────────────────────────────────────────
  { slug: 'executive-dashboard', name: 'Executive Dashboard', category: 'management', data_source_key: 'management.executive_dashboard',
    description: 'Earned Value Management metrics — SPI, CPI, BAC, EAC, variance analysis.',
    subject_template: 'Executive Dashboard — {{date}}', filename_template: 'executive_{{date}}.pdf',
    supports_ai_summary: true, params: ['site', 'event'],
    sections: [
      { key: 'kpis', name: 'EVM Metrics', type: 'kpi_cards', is_required: true },
      { key: 'evm_table', name: 'EVM Details', type: 'data' },
      { key: 'summary', name: 'Executive Summary', type: 'summary' },
    ] },
  { slug: 'kpi-dashboard', name: 'KPI Dashboard', category: 'management', data_source_key: 'management.kpi_dashboard',
    description: 'Key Performance Indicators — workpack completion, activity status, punch items.',
    subject_template: 'KPI Dashboard — {{date}}', filename_template: 'kpi_{{date}}.pdf',
    params: ['site', 'event'],
    sections: [
      { key: 'kpis', name: 'KPI Cards', type: 'kpi_cards', is_required: true },
    ] },
  { slug: 'scurve-report', name: 'S-Curve Report', category: 'management', data_source_key: 'management.scurve',
    description: 'Planned vs Actual vs Earned value S-curve.',
    subject_template: 'S-Curve — {{date}}', filename_template: 'scurve_{{date}}.pdf',
    params: ['site', 'event'],
    sections: [
      { key: 'scurve_chart', name: 'S-Curve', type: 'chart', is_required: true },
      { key: 'summary', name: 'Summary', type: 'summary' },
    ] },
  { slug: 'spi-trend', name: 'SPI Trend', category: 'management', data_source_key: 'management.spi',
    description: 'Schedule Performance Index trend.',
    params: ['site', 'event'],
    sections: [{ key: 'kpis', name: 'SPI', type: 'kpi_cards', is_required: true }, { key: 'summary', name: 'Analysis', type: 'summary' }] },
  { slug: 'cpi-trend', name: 'CPI Trend', category: 'management', data_source_key: 'management.cpi',
    description: 'Cost Performance Index trend.',
    params: ['site', 'event'],
    sections: [{ key: 'kpis', name: 'CPI', type: 'kpi_cards', is_required: true }, { key: 'summary', name: 'Analysis', type: 'summary' }] },
  { slug: 'cost-summary', name: 'Cost Summary', category: 'management', data_source_key: 'management.cost_summary',
    description: 'Cost breakdown — BAC, EAC, variance.',
    params: ['site', 'event'],
    sections: [
      { key: 'kpis', name: 'Cost KPIs', type: 'kpi_cards' },
      { key: 'cost_table', name: 'Cost Details', type: 'data', is_required: true },
    ] },
  { slug: 'resource-summary', name: 'Resource Summary', category: 'management', data_source_key: 'management.resource_summary',
    description: 'Resource allocation and utilization by type.',
    params: ['site', 'event'],
    sections: [
      { key: 'resource_table', name: 'Resources', type: 'data', is_required: true },
    ] },
  // ── Platform (4) ───────────────────────────────────────────────────────────
  { slug: 'user-activity', name: 'User Activity Report', category: 'platform', data_source_key: 'platform.user_activity',
    description: 'User action counts and activity summary.',
    params: ['date_from', 'date_to'],
    sections: [
      { key: 'kpis', name: 'Activity Summary', type: 'kpi_cards' },
      { key: 'user_table', name: 'User Activity', type: 'data', is_required: true },
    ] },
  { slug: 'audit-log-report', name: 'Audit Log Report', category: 'platform', data_source_key: 'platform.audit_log',
    description: 'Detailed audit log entries.',
    params: ['date_from', 'date_to'],
    sections: [
      { key: 'kpis', name: 'Log Summary', type: 'kpi_cards' },
      { key: 'log_table', name: 'Audit Entries', type: 'data', is_required: true },
    ] },
  { slug: 'notification-statistics', name: 'Notification Statistics', category: 'platform', data_source_key: 'platform.notification_statistics',
    description: 'Notification delivery statistics — sent, failed, pending.',
    params: ['date_from', 'date_to'],
    sections: [
      { key: 'kpis', name: 'Delivery Stats', type: 'kpi_cards', is_required: true },
    ] },
  { slug: 'login-history', name: 'Login History', category: 'platform', data_source_key: 'platform.login_history',
    description: 'User login events.',
    params: ['date_from', 'date_to'],
    sections: [
      { key: 'kpis', name: 'Login Summary', type: 'kpi_cards' },
      { key: 'login_table', name: 'Login Events', type: 'data', is_required: true },
    ] },
];

// ─── Default Layout ─────────────────────────────────────────────────────────

const DEFAULT_LAYOUT = {
  name: 'Corporate Standard',
  slug: 'corporate-standard',
  description: 'Default corporate report layout with professional styling.',
  primary_color: '#0D2137',
  accent_color: '#E8701A',
  page_size: 'A4',
  orientation: 'portrait' as const,
  margin_top: 20,
  margin_bottom: 20,
  margin_left: 15,
  margin_right: 15,
  font_family: 'Inter, Arial, sans-serif',
  font_size_base: 12,
  show_signature: true,
  signature_labels: ['Prepared By', 'Reviewed By', 'Approved By'],
  is_system: true,
  is_active: true,
  footer_html: '<div style="font-size:10px;color:#9CA3AF;text-align:center;padding:8px 0;border-top:1px solid #E5E7EB;">AURIANOA OS — Generated {{date}} — Page {{page}} of {{total_pages}} — CONFIDENTIAL</div>',
};

// ─── Main Seed ──────────────────────────────────────────────────────────────

export async function seedReportBuilder() {
  console.log('  📊 Seeding Report Builder...');

  // 1. Categories
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const existing = await prisma.report_categories.findUnique({ where: { slug: cat.slug } });
    if (existing) {
      categoryMap.set(cat.slug, existing.id);
      continue;
    }
    const created = await prisma.report_categories.create({ data: cat });
    categoryMap.set(cat.slug, created.id);
  }
  console.log(`    ✅ ${CATEGORIES.length} categories`);

  // 2. Parameters
  const paramMap = new Map<string, string>();
  for (const param of PARAMETERS) {
    const existing = await prisma.report_parameters.findUnique({ where: { key: param.key } });
    if (existing) {
      paramMap.set(param.key, existing.id);
      continue;
    }
    const created = await prisma.report_parameters.create({
      data: {
        key: param.key,
        name: param.name,
        param_type: param.param_type,
        options_source: (param as any).options_source ?? null,
        options_static: (param as any).options_static ?? null,
        default_value: (param as any).default_value ?? null,
        sort_order: param.sort_order,
      },
    });
    paramMap.set(param.key, created.id);
  }
  console.log(`    ✅ ${PARAMETERS.length} parameters`);

  // 3. Default Layout
  const existingLayout = await prisma.report_layouts.findUnique({ where: { slug: DEFAULT_LAYOUT.slug } });
  if (!existingLayout) {
    await prisma.report_layouts.create({ data: DEFAULT_LAYOUT });
  }
  console.log('    ✅ Default layout');

  // 4. Definitions + Sections + Parameter links
  let defCount = 0;
  for (const def of DEFINITIONS) {
    const existing = await prisma.report_definitions.findUnique({ where: { slug: def.slug } });
    if (existing) { defCount++; continue; }

    const catId = categoryMap.get(def.category);
    if (!catId) { console.warn(`    ⚠️ Category not found: ${def.category}`); continue; }

    const created = await prisma.report_definitions.create({
      data: {
        category_id: catId,
        slug: def.slug,
        name: def.name,
        description: def.description,
        data_source_key: def.data_source_key,
        subject_template: def.subject_template ?? null,
        filename_template: def.filename_template ?? null,
        supports_ai_summary: def.supports_ai_summary ?? false,
        is_system: true,
        is_active: true,
      },
    });

    // Sections
    for (let i = 0; i < def.sections.length; i++) {
      const sec = def.sections[i];
      await prisma.report_sections.create({
        data: {
          definition_id: created.id,
          key: sec.key,
          name: sec.name,
          section_type: sec.type ?? 'data',
          sort_order: i,
          is_default: sec.is_default !== false,
          is_required: sec.is_required ?? false,
        },
      });
    }

    // Parameter links
    if (def.params) {
      for (let i = 0; i < def.params.length; i++) {
        const paramId = paramMap.get(def.params[i]);
        if (paramId) {
          await prisma.report_definition_parameters.create({
            data: {
              definition_id: created.id,
              parameter_id: paramId,
              sort_order: i,
            },
          });
        }
      }
    }

    defCount++;
  }
  console.log(`    ✅ ${defCount} report definitions (with sections & parameters)`);
  console.log('  📊 Report Builder seed complete.');
}

// Allow standalone execution
if (require.main === module) {
  seedReportBuilder()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
