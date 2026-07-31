/**
 * M7.6C — OIS Seed Data
 *
 * Seeds widget definitions and dashboard templates.
 * Run with: npx ts-node prisma/seed-ois-templates.ts
 *
 * Widget definitions cover all provider categories.
 * Templates cover the 18 required dashboard configurations.
 */

import { prisma, disconnect } from './seed-client';

// ─── Widget Definitions ─────────────────────────────────────────────────────

const WIDGET_DEFINITIONS = [
  // ── Safety ──────────────────────────────────────────────────────────────
  { slug: 'safety_trir_gauge', name: 'TRIR Gauge', category: 'safety', icon: '🦺', provider_key: 'safety.kpi_summary', visualization_type: 'gauge', default_config: { min: 0, max: 10, valueKey: 'trir', segments: [{ from: 0, to: 1, color: '#10B981' }, { from: 1, to: 2, color: '#F59E0B' }, { from: 2, to: 10, color: '#DC2626' }] }, supports_threshold: true, description: 'Total Recordable Incident Rate gauge.' },
  { slug: 'safety_lti_card', name: 'LTI KPI Card', category: 'safety', icon: '🏥', provider_key: 'safety.kpi_summary', visualization_type: 'kpi_card', default_config: { layout: 'grid', maxCards: 4 }, description: 'Lost Time Injury count and frequency rate.' },
  { slug: 'safety_near_miss_trend', name: 'Near Miss Trend', category: 'safety', icon: '⚡', provider_key: 'safety.trend', visualization_type: 'line', default_config: { xAxisKey: 'date', yAxisKeys: ['nearMiss', 'firstAid'], showGrid: true, showLegend: true }, description: 'Near miss and first aid trend line.' },
  { slug: 'safety_incident_table', name: 'Incident Register', category: 'safety', icon: '📋', provider_key: 'safety.incident_register', visualization_type: 'data_table', default_config: { pageSize: 15, showSearch: true, stickyHeader: true }, description: 'Full incident register with filtering.' },
  { slug: 'safety_ptw_status', name: 'PTW Status', category: 'safety', icon: '📝', provider_key: 'safety.kpi_summary', visualization_type: 'status_card', default_config: {}, description: 'Permit to Work issued/closed/suspended status.' },
  { slug: 'safety_daily_log', name: 'Daily Safety Log', category: 'safety', icon: '📅', provider_key: 'safety.daily_log', visualization_type: 'kpi_card', default_config: { layout: 'grid', maxCards: 9 }, description: 'Daily safety log KPI snapshot.' },
  { slug: 'safety_observation_trend', name: 'Safety Observation Trend', category: 'safety', icon: '📊', provider_key: 'safety.trend', visualization_type: 'area', default_config: { xAxisKey: 'date', yAxisKeys: ['lti', 'nearMiss', 'medicalTreatment'], showLegend: true, fillOpacity: 0.3 }, description: 'Safety observation stacked area chart.' },
  { slug: 'safety_manhours_card', name: 'Manhours Worked', category: 'safety', icon: '⏱️', provider_key: 'safety.kpi_summary', visualization_type: 'kpi_card', default_config: { layout: 'horizontal', maxCards: 3 }, description: 'Total manhours worked KPI.' },
  { slug: 'safety_score_gauge', name: 'Safety Score', category: 'safety', icon: '🎯', provider_key: 'safety.kpi_summary', visualization_type: 'gauge', default_config: { min: 0, max: 100, valueKey: 'safetyScore' }, supports_threshold: true, description: 'Overall safety score gauge.' },
  { slug: 'safety_kpi_dashboard', name: 'Safety KPI Dashboard', category: 'safety', icon: '🛡️', provider_key: 'safety.kpi_summary', visualization_type: 'kpi_card', default_config: { layout: 'grid', maxCards: 12 }, description: 'Comprehensive safety KPI cards.' },

  // ── Planning ────────────────────────────────────────────────────────────
  { slug: 'planning_lookahead_24h', name: '24hr Look Ahead', category: 'planning', icon: '📋', provider_key: 'planning.lookahead_24h', visualization_type: 'data_table', default_config: { pageSize: 20, showSearch: true }, description: 'Activities starting within 24 hours.' },
  { slug: 'planning_lookahead_72h', name: '72hr Look Ahead', category: 'planning', icon: '📅', provider_key: 'planning.lookahead_72h', visualization_type: 'data_table', default_config: { pageSize: 25, showSearch: true }, description: 'Activities starting within 72 hours.' },
  { slug: 'planning_constraint_heatmap', name: 'Constraint Heatmap', category: 'planning', icon: '🗺️', provider_key: 'planning.constraint_register', visualization_type: 'heatmap', default_config: { colorPalette: ['#10B981', '#F59E0B', '#DC2626'] }, description: 'Constraint register heatmap by status.' },
  { slug: 'planning_critical_path', name: 'Critical Path Summary', category: 'planning', icon: '🔴', provider_key: 'planning.critical_path_summary', visualization_type: 'data_table', default_config: { showSearch: true }, description: 'Critical path activities summary.' },
  { slug: 'planning_workpack_readiness', name: 'Workpack Readiness', category: 'planning', icon: '✅', provider_key: 'planning.workpack_readiness', visualization_type: 'progress_card', default_config: { showPercentage: true }, description: 'Workpack readiness checklist progress.' },

  // ── Execution ───────────────────────────────────────────────────────────
  { slug: 'execution_progress_bar', name: 'Execution Progress', category: 'execution', icon: '📈', provider_key: 'workspace.event_rollup', visualization_type: 'progress_card', default_config: { showPercentage: true }, description: 'Overall execution progress from RollupEngine.' },
  { slug: 'execution_workpack_status', name: 'Workpack Status', category: 'execution', icon: '📦', provider_key: 'workspace.event_rollup', visualization_type: 'kpi_card', default_config: { layout: 'grid', maxCards: 6 }, description: 'Workpack completion status KPIs.' },
  { slug: 'execution_scurve', name: 'S-Curve', category: 'execution', icon: '📊', provider_key: 'workspace.event_rollup', visualization_type: 'scurve', default_config: { showGrid: true, showLegend: true, curved: true }, description: 'Planned vs actual S-curve.' },
  { slug: 'execution_hierarchy_progress', name: 'Unit Progress', category: 'execution', icon: '🏗️', provider_key: 'workspace.hierarchy_progress', visualization_type: 'data_table', default_config: { showSearch: true }, description: 'Unit/system-level progress breakdown.' },

  // ── Shutdown ─────────────────────────────────────────────────────────────
  { slug: 'shutdown_scope_register', name: 'Scope Register', category: 'shutdown', icon: '📄', provider_key: 'shutdown.scope_register', visualization_type: 'data_table', default_config: { pageSize: 20 }, description: 'Shutdown scope register.' },
  { slug: 'shutdown_punch_summary', name: 'Punch Summary', category: 'shutdown', icon: '📍', provider_key: 'shutdown.punch_summary', visualization_type: 'kpi_card', default_config: { layout: 'grid' }, description: 'Punch list summary by category.' },
  { slug: 'shutdown_material_status', name: 'Material Status', category: 'shutdown', icon: '📦', provider_key: 'shutdown.material_status', visualization_type: 'stacked_bar', default_config: { showLegend: true }, description: 'Material readiness by workpack.' },

  // ── Workforce ───────────────────────────────────────────────────────────
  { slug: 'workforce_headcount', name: 'Workforce Headcount', category: 'workforce', icon: '👷', provider_key: 'workforce.headcount', visualization_type: 'line', default_config: { xAxisKey: 'date', yAxisKeys: ['planned', 'actual'], showGrid: true }, description: 'Daily planned vs actual headcount.' },
  { slug: 'workforce_headcount_card', name: 'Current Headcount', category: 'workforce', icon: '👥', provider_key: 'workforce.headcount', visualization_type: 'kpi_card', default_config: { layout: 'horizontal', maxCards: 3 }, description: 'Current headcount KPI card.' },
  { slug: 'workforce_utilization', name: 'Crew Utilization', category: 'workforce', icon: '⚙️', provider_key: 'workforce.crew_utilization', visualization_type: 'bar', default_config: { showLegend: true, barSize: 20 }, description: 'Resource utilization by type.' },
  { slug: 'workforce_manhour_trend', name: 'Manhour Trend', category: 'workforce', icon: '⏱️', provider_key: 'workforce.manhour_analysis', visualization_type: 'area', default_config: { xAxisKey: 'date', yAxisKeys: ['worked', 'planned'], fillOpacity: 0.2 }, description: 'Daily manhour trend analysis.' },

  // ── Management ──────────────────────────────────────────────────────────
  { slug: 'management_evm', name: 'Earned Value Management', category: 'management', icon: '💰', provider_key: 'workspace.event_rollup', visualization_type: 'evm', default_config: { showGrid: true, showLegend: true }, description: 'EVM chart — PV, EV, AC.' },
];

// ─── Dashboard Templates ────────────────────────────────────────────────────

const DASHBOARD_TEMPLATES = [
  { slug: 'tmpl-director-cockpit', name: 'Director Cockpit', dashboard_type: 'cockpit', category: 'executive', icon: '🎛️', description: 'Executive cockpit for shutdown directors.', widgets: ['execution_progress_bar', 'safety_kpi_dashboard', 'planning_lookahead_24h', 'execution_scurve', 'workforce_headcount_card', 'shutdown_punch_summary'] },
  { slug: 'tmpl-shutdown-director', name: 'Shutdown Director', dashboard_type: 'cockpit', category: 'executive', icon: '🔧', description: 'Full shutdown oversight cockpit.', widgets: ['execution_workpack_status', 'safety_trir_gauge', 'planning_constraint_heatmap', 'shutdown_scope_register', 'execution_scurve', 'workforce_headcount'] },
  { slug: 'tmpl-planning-dashboard', name: 'Planning Dashboard', dashboard_type: 'dashboard', category: 'planning', icon: '📋', description: 'Planning activities overview.', widgets: ['planning_lookahead_24h', 'planning_lookahead_72h', 'planning_critical_path', 'planning_constraint_heatmap', 'planning_workpack_readiness'] },
  { slug: 'tmpl-execution-dashboard', name: 'Execution Dashboard', dashboard_type: 'dashboard', category: 'execution', icon: '📈', description: 'Real-time execution metrics.', widgets: ['execution_progress_bar', 'execution_workpack_status', 'execution_scurve', 'execution_hierarchy_progress'] },
  { slug: 'tmpl-safety-dashboard', name: 'Safety Dashboard', dashboard_type: 'dashboard', category: 'safety', icon: '🦺', description: 'Complete safety overview.', widgets: ['safety_trir_gauge', 'safety_kpi_dashboard', 'safety_near_miss_trend', 'safety_incident_table', 'safety_observation_trend', 'safety_daily_log'] },
  { slug: 'tmpl-contractor-dashboard', name: 'Contractor Dashboard', dashboard_type: 'dashboard', category: 'execution', icon: '🏗️', description: 'Contractor performance view.', widgets: ['workforce_utilization', 'workforce_headcount', 'execution_progress_bar', 'safety_lti_card'] },
  { slug: 'tmpl-project-controls', name: 'Project Controls', dashboard_type: 'dashboard', category: 'management', icon: '🎯', description: 'Project controls metrics.', widgets: ['execution_scurve', 'management_evm', 'execution_workpack_status', 'workforce_manhour_trend'] },
  { slug: 'tmpl-portfolio', name: 'Portfolio Dashboard', dashboard_type: 'dashboard', category: 'executive', icon: '📊', description: 'Multi-event portfolio overview.', widgets: ['execution_progress_bar', 'safety_kpi_dashboard', 'workforce_headcount_card', 'management_evm'] },
  { slug: 'tmpl-executive', name: 'Executive Dashboard', dashboard_type: 'dashboard', category: 'executive', icon: '👔', description: 'C-suite executive summary.', widgets: ['execution_progress_bar', 'safety_trir_gauge', 'workforce_headcount_card', 'execution_scurve'] },
  { slug: 'tmpl-corporate', name: 'Corporate Dashboard', dashboard_type: 'dashboard', category: 'executive', icon: '🏢', description: 'Corporate level overview.', widgets: ['execution_progress_bar', 'safety_kpi_dashboard', 'workforce_headcount_card'] },
  { slug: 'tmpl-qaqc-dashboard', name: 'QA/QC Dashboard', dashboard_type: 'dashboard', category: 'execution', icon: '🔍', description: 'Quality assurance overview.', widgets: ['shutdown_punch_summary', 'execution_workpack_status', 'planning_workpack_readiness'] },
  { slug: 'tmpl-inspection', name: 'Inspection Dashboard', dashboard_type: 'dashboard', category: 'execution', icon: '🔎', description: 'Inspection status overview.', widgets: ['execution_workpack_status', 'shutdown_punch_summary', 'safety_ptw_status'] },
  { slug: 'tmpl-mechanical', name: 'Mechanical Dashboard', dashboard_type: 'dashboard', category: 'execution', icon: '⚙️', description: 'Mechanical discipline overview.', widgets: ['execution_hierarchy_progress', 'shutdown_material_status', 'workforce_utilization'] },
  { slug: 'tmpl-management', name: 'Management Dashboard', dashboard_type: 'dashboard', category: 'management', icon: '📊', description: 'Management overview with KPIs.', widgets: ['execution_progress_bar', 'safety_kpi_dashboard', 'management_evm', 'workforce_manhour_trend'] },
  { slug: 'tmpl-tv-dashboard', name: 'TV Dashboard', dashboard_type: 'tv', category: 'executive', icon: '📺', description: 'Auto-rotating TV display.', widgets: ['execution_progress_bar', 'safety_trir_gauge', 'workforce_headcount_card', 'planning_lookahead_24h'] },
  { slug: 'tmpl-morning-meeting', name: 'Morning Meeting', dashboard_type: 'meeting', category: 'planning', icon: '☀️', description: 'Morning meeting presentation.', widgets: ['safety_daily_log', 'planning_lookahead_24h', 'execution_progress_bar', 'workforce_headcount_card'] },
  { slug: 'tmpl-night-shift', name: 'Night Shift Dashboard', dashboard_type: 'dashboard', category: 'execution', icon: '🌙', description: 'Night shift handover dashboard.', widgets: ['safety_daily_log', 'execution_progress_bar', 'workforce_headcount_card'] },
  { slug: 'tmpl-maintenance', name: 'Maintenance Dashboard', dashboard_type: 'dashboard', category: 'execution', icon: '🛠️', description: 'Maintenance operations overview.', widgets: ['execution_workpack_status', 'shutdown_punch_summary', 'shutdown_material_status', 'workforce_utilization'] },
];

// ─── Seed Function ──────────────────────────────────────────────────────────

async function seedOIS() {
  console.log('🌱 Seeding OIS widget definitions...');

  // Upsert widget definitions
  for (const def of WIDGET_DEFINITIONS) {
    await prisma.ois_widget_definitions.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description ?? '',
        category: def.category,
        icon: def.icon,
        provider_key: def.provider_key,
        visualization_type: def.visualization_type,
        default_config: def.default_config ?? {},
        supported_filters: ['event', 'unit', 'contractor', 'date_range'],
        supports_threshold: def.supports_threshold ?? false,
        is_system: true,
        is_active: true,
        author: 'SYORITY',
        version: 1,
      },
      update: {
        name: def.name,
        description: def.description ?? '',
        category: def.category,
        icon: def.icon,
        provider_key: def.provider_key,
        visualization_type: def.visualization_type,
        default_config: def.default_config ?? {},
      },
    });
  }

  console.log(`  ✅ ${WIDGET_DEFINITIONS.length} widget definitions seeded.`);

  // Upsert dashboard templates
  console.log('🌱 Seeding OIS dashboard templates...');

  for (const tmpl of DASHBOARD_TEMPLATES) {
    const existing = await prisma.ois_dashboard_definitions.findUnique({
      where: { slug: tmpl.slug },
    });

    if (!existing) {
      const dashboard = await prisma.ois_dashboard_definitions.create({
        data: {
          slug: tmpl.slug,
          name: tmpl.name,
          description: tmpl.description,
          dashboard_type: tmpl.dashboard_type,
          category: tmpl.category,
          icon: tmpl.icon,
          is_template: true,
          is_system: true,
          is_published: true,
          version: 1,
          layout_config: { gridColumns: 12, gridRowHeight: 80 },
        },
      });

      // Create default page
      const page = await prisma.ois_dashboard_pages.create({
        data: {
          dashboard_id: dashboard.id,
          page_number: 1,
          title: 'Overview',
        },
      });

      // Add template widgets in a 2-column grid layout
      let col = 0;
      let row = 0;
      for (const widgetSlug of tmpl.widgets) {
        const widgetDef = await prisma.ois_widget_definitions.findUnique({
          where: { slug: widgetSlug },
        });
        if (widgetDef) {
          const w = 6; // Half-width
          const h = 3;
          await prisma.ois_dashboard_widgets.create({
            data: {
              dashboard_id: dashboard.id,
              page_id: page.id,
              widget_definition_id: widgetDef.id,
              grid_x: col * 6,
              grid_y: row * h,
              grid_w: w,
              grid_h: h,
              sort_order: row * 2 + col,
            },
          });
          col++;
          if (col >= 2) { col = 0; row++; }
        }
      }
    }
  }

  console.log(`  ✅ ${DASHBOARD_TEMPLATES.length} dashboard templates seeded.`);
  console.log('🎉 OIS seed complete!');
}

seedOIS()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => disconnect());
