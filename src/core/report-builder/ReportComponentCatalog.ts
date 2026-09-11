/**
 * M14-R5 — Governed Report Component Catalog
 *
 * Provides a curated, enterprise component catalogue for the Report Designer.
 * All data-driven components consume values strictly from the immutable ReportDataset.
 * ZERO independent database queries. ZERO business metric recalculations.
 */

import type { ReportDataset } from './ReportGenerationService';

export type ComponentCategory = 'layout' | 'text' | 'kpi' | 'charts' | 'tables' | 'control';

export interface ReportComponentDefinition {
  type: string;
  name: string;
  category: ComponentCategory;
  icon: string;
  description: string;
  defaultConfig: Record<string, any>;
  supportedOutputs: Array<'html' | 'pdf' | 'excel' | 'csv'>;
  extractData?: (dataset: ReportDataset, config?: Record<string, any>) => any;
}

export const REPORT_COMPONENT_CATALOG: ReportComponentDefinition[] = [
  // ─── Layout Components ──────────────────────────────────────────────────
  {
    type: 'layout.page',
    name: 'Page',
    category: 'layout',
    icon: '📄',
    description: 'Root page container defining page size, margins, and orientation',
    defaultConfig: { size: 'A4', orientation: 'portrait', marginTop: 20, marginBottom: 20, marginLeft: 15, marginRight: 15 },
    supportedOutputs: ['html', 'pdf'],
  },
  {
    type: 'layout.section',
    name: 'Section',
    category: 'layout',
    icon: '🔲',
    description: 'Collapsible structural container grouping rows and cards',
    defaultConfig: { title: 'New Section', collapsible: false, backgroundColor: '#ffffff', padding: 16 },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
  },
  {
    type: 'layout.row',
    name: 'Row',
    category: 'layout',
    icon: '↔️',
    description: 'Horizontal grid row supporting multi-column layouts',
    defaultConfig: { columns: 12, gap: 16 },
    supportedOutputs: ['html', 'pdf'],
  },
  {
    type: 'layout.column',
    name: 'Column',
    category: 'layout',
    icon: '↕️',
    description: 'Vertical column container with adjustable grid span',
    defaultConfig: { span: 6 },
    supportedOutputs: ['html', 'pdf'],
  },
  {
    type: 'layout.spacer',
    name: 'Spacer',
    category: 'layout',
    icon: '␣',
    description: 'Adjustable vertical spacing block',
    defaultConfig: { heightPx: 24 },
    supportedOutputs: ['html', 'pdf'],
  },
  {
    type: 'layout.page_break',
    name: 'Page Break',
    category: 'layout',
    icon: '✂️',
    description: 'Forces hard page break in PDF export and print media',
    defaultConfig: { printOnly: true },
    supportedOutputs: ['html', 'pdf'],
  },

  // ─── Text & Typography ─────────────────────────────────────────────────
  {
    type: 'text.title',
    name: 'Report Title',
    category: 'text',
    icon: '🏷️',
    description: 'Primary report heading with customizable typography and event binding',
    defaultConfig: { text: 'DAILY TURNAROUND REPORT', fontSize: 24, fontWeight: 'bold', align: 'left' },
    supportedOutputs: ['html', 'pdf', 'excel'],
    extractData: (dataset, config) => config?.text || dataset.reportId,
  },
  {
    type: 'text.subtitle',
    name: 'Subtitle',
    category: 'text',
    icon: '📝',
    description: 'Secondary subheading or shift note caption',
    defaultConfig: { text: 'Execution Progress & Lookahead Schedule', fontSize: 14, color: '#6B7280' },
    supportedOutputs: ['html', 'pdf', 'excel'],
  },
  {
    type: 'text.paragraph',
    name: 'Paragraph',
    category: 'text',
    icon: '¶',
    description: 'Narrative paragraph block for executive notes and handover details',
    defaultConfig: { text: 'Turnaround activities progressing in accordance with baseline schedule.' },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.summary || '',
  },
  {
    type: 'text.rich_text',
    name: 'Rich Text',
    category: 'text',
    icon: '✏️',
    description: 'Formatted HTML/markdown text with bold, italics, bullets',
    defaultConfig: { html: '<p><strong>Shift Highlights:</strong> Mechanical handover completed on schedule.</p>' },
    supportedOutputs: ['html', 'pdf'],
  },
  {
    type: 'text.label',
    name: 'Field Label',
    category: 'text',
    icon: '🔖',
    description: 'Compact key-value label pair for metadata indicators',
    defaultConfig: { label: 'Facility', value: 'Apex Euro Refining Complex' },
    supportedOutputs: ['html', 'pdf', 'excel'],
  },

  // ─── KPI Cards & Summaries ──────────────────────────────────────────────
  {
    type: 'kpi.card',
    name: 'KPI Card',
    category: 'kpi',
    icon: '🔢',
    description: 'Single metric card displaying authoritative value, unit, and indicator color',
    defaultConfig: { metricKey: 'overall_progress', label: 'Overall Progress', format: 'percentage' },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset, config) => {
      const kpis = dataset.data?.kpis || [];
      return kpis.find((k: any) => k.label?.toLowerCase().includes(config?.metricKey?.toLowerCase())) || kpis[0] || null;
    },
  },
  {
    type: 'kpi.group',
    name: 'KPI Group',
    category: 'kpi',
    icon: '📊',
    description: 'Grid of KPI cards showing the full executive summary deck',
    defaultConfig: { columns: 4 },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.kpis || [],
  },
  {
    type: 'kpi.progress',
    name: 'Progress KPI',
    category: 'kpi',
    icon: '📈',
    description: 'Visual progress card with progress bar and planned vs actual badge from M8.13',
    defaultConfig: { showPlanned: true, showVariance: true },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => {
      const kpis = dataset.data?.kpis || [];
      return {
        progress: kpis.find((k: any) => k.label?.toLowerCase().includes('progress'))?.value || '0%',
        planned: kpis.find((k: any) => k.label?.toLowerCase().includes('planned'))?.value || '0%',
      };
    },
  },
  {
    type: 'kpi.status',
    name: 'Status KPI',
    category: 'kpi',
    icon: '🚦',
    description: 'Categorical status indicator (ON_TRACK, AT_RISK, CRITICAL_DELAY)',
    defaultConfig: { metricKey: 'status' },
    supportedOutputs: ['html', 'pdf', 'excel'],
    extractData: (dataset) => dataset.data?.kpis?.find((k: any) => k.label?.toLowerCase().includes('status')) || null,
  },
  {
    type: 'kpi.exception',
    name: 'Exception KPI',
    category: 'kpi',
    icon: '⚠️',
    description: 'Count of active P1/P2 management exceptions from M13 Control Tower',
    defaultConfig: { priorityFilter: 'P1' },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.kpis?.find((k: any) => k.label?.toLowerCase().includes('exception') || k.label?.toLowerCase().includes('critical')) || null,
  },

  // ─── Charts & Trends ───────────────────────────────────────────────────
  {
    type: 'chart.bar',
    name: 'Bar Chart',
    category: 'charts',
    icon: '📊',
    description: 'Categorical bar chart (e.g. Unit progress or Delay categories)',
    defaultConfig: { xAxis: 'name', yAxis: 'progress', color: '#0D2137' },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.chartData || dataset.data?.rows || [],
  },
  {
    type: 'chart.stacked_bar',
    name: 'Stacked Bar Chart',
    category: 'charts',
    icon: '📶',
    description: 'Stacked breakdown (Completed, In Progress, Delayed, Not Started)',
    defaultConfig: { categories: ['completed', 'in_progress', 'delayed', 'not_started'] },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.chartData || [],
  },
  {
    type: 'chart.line',
    name: 'Line Chart',
    category: 'charts',
    icon: '📉',
    description: 'Chronological timeline trends and daily progress burn-up',
    defaultConfig: { xAxis: 'date', yAxis: 'cumulative_progress' },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.chartData || dataset.data?.rows || [],
  },
  {
    type: 'chart.scurve',
    name: 'S-Curve Presentation',
    category: 'charts',
    icon: '〰️',
    description: 'Cumulative EVM curve (PV, EV, AC, EAC) strictly from M8.10',
    defaultConfig: { showEac: true, showAc: true, showPv: true, showEv: true },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.chartData || dataset.data?.rows || [],
  },
  {
    type: 'chart.progress_distribution',
    name: 'Progress Distribution',
    category: 'charts',
    icon: '🍩',
    description: 'Donut chart of activity completion status distribution',
    defaultConfig: { innerRadius: 60 },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.chartData || [],
  },
  {
    type: 'chart.contractor_comparison',
    name: 'Contractor Comparison',
    category: 'charts',
    icon: '👥',
    description: 'Multi-contractor headcount, hours burned, and workpack progress comparison',
    defaultConfig: { metric: 'progress' },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.rows || [],
  },
  {
    type: 'chart.discipline_comparison',
    name: 'Discipline Comparison',
    category: 'charts',
    icon: '🛠️',
    description: 'Progress and open constraints broken down across engineering disciplines',
    defaultConfig: { metric: 'progress_percent' },
    supportedOutputs: ['html', 'pdf'],
    extractData: (dataset) => dataset.data?.rows || [],
  },

  // ─── Data Tables ───────────────────────────────────────────────────────
  {
    type: 'table.activity',
    name: 'Activity Table',
    category: 'tables',
    icon: '📋',
    description: 'Authoritative activity execution table with progress, dates, and float',
    defaultConfig: {
      columns: ['activity_number', 'description', 'discipline', 'contractor', 'planned_start', 'planned_finish', 'progress_percent', 'status'],
      pageSize: 50,
      showHeaders: true,
      repeatHeaderPdf: true,
      groupBy: null,
    },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.rows || [],
  },
  {
    type: 'table.equipment',
    name: 'Equipment Table',
    category: 'tables',
    icon: '⚙️',
    description: 'Major equipment status and unit progress table',
    defaultConfig: {
      columns: ['tag_number', 'equipment_type', 'unit', 'progress_percent', 'status'],
      pageSize: 25,
      groupBy: 'unit',
    },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.rows || [],
  },
  {
    type: 'table.workpack',
    name: 'Workpack Table',
    category: 'tables',
    icon: '💼',
    description: 'Workpack readiness and execution status register',
    defaultConfig: {
      columns: ['workpack_number', 'title', 'discipline', 'readiness_state', 'progress_percent'],
      pageSize: 25,
    },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.rows || [],
  },
  {
    type: 'table.constraint',
    name: 'Constraint Table',
    category: 'tables',
    icon: '🚧',
    description: 'Blocking issues, material shortages, and permit holds',
    defaultConfig: {
      columns: ['title', 'equipment', 'category', 'status', 'is_blocking', 'target_resolution_date'],
      pageSize: 25,
    },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.rows || [],
  },
  {
    type: 'table.hold_delay',
    name: 'Hold & Delay Table',
    category: 'tables',
    icon: '⏱️',
    description: 'Holds, finish variance, and root causes strictly from M12',
    defaultConfig: {
      columns: ['activity_number', 'equipment', 'hold_reason', 'delay_category', 'duration_hours', 'impact'],
      pageSize: 25,
    },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.rows || [],
  },
  {
    type: 'table.critical_activity',
    name: 'Critical Activity Table',
    category: 'tables',
    icon: '🎯',
    description: 'Critical path activities (total float = 0) from M11 CPM engine',
    defaultConfig: {
      columns: ['activity_number', 'description', 'unit', 'total_float', 'early_finish', 'late_finish'],
      pageSize: 25,
    },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.rows || [],
  },
  {
    type: 'table.identical_activity',
    name: 'Identical Activity Table',
    category: 'tables',
    icon: '🔁',
    description: 'Repetitive standard activity metrics with visual progress bars',
    defaultConfig: {
      columns: ['standard_activity', 'equipment_type', 'progress_percent', 'progress_bar', 'planned_quantity', 'completed_quantity'],
      pageSize: 25,
    },
    supportedOutputs: ['html', 'pdf', 'excel', 'csv'],
    extractData: (dataset) => dataset.data?.rows || [],
  },

  // ─── Control & Governance ──────────────────────────────────────────────
  {
    type: 'control.filter_summary',
    name: 'Filter Summary',
    category: 'control',
    icon: '🔍',
    description: 'Audit box showing all dimensions and tenant UDF filters applied to this dataset',
    defaultConfig: { showHash: true, showDateAsOf: true },
    supportedOutputs: ['html', 'pdf', 'excel'],
    extractData: (dataset) => ({
      parameters: dataset.parameters || {},
      dataAsOf: dataset.dataAsOf,
      datasetHash: dataset.datasetHash,
    }),
  },
  {
    type: 'control.report_metadata',
    name: 'Report Metadata',
    category: 'control',
    icon: 'ℹ️',
    description: 'Generated timestamp, author, definition version, and authority sources',
    defaultConfig: { showAuthorities: true },
    supportedOutputs: ['html', 'pdf', 'excel'],
    extractData: (dataset) => ({
      generatedAt: dataset.generatedAt,
      generatedBy: dataset.generatedBy,
      authoritySources: dataset.provenance?.authoritySources || [],
    }),
  },
  {
    type: 'control.confidentiality_banner',
    name: 'Confidentiality Banner',
    category: 'control',
    icon: '🔒',
    description: 'Standard enterprise security classification (e.g. CONFIDENTIAL / INTERNAL ONLY)',
    defaultConfig: { label: 'STRICTLY CONFIDENTIAL — TURNAROUND MANAGEMENT ONLY', color: '#DC2626' },
    supportedOutputs: ['html', 'pdf'],
  },
  {
    type: 'control.signature_block',
    name: 'Signature Block',
    category: 'control',
    icon: '✍️',
    description: 'Formal sign-off boxes for Shift Superintendent, Planning Lead, and Operations',
    defaultConfig: {
      signatures: ['Shift Superintendent', 'Turnaround Planning Lead', 'Operations Representative'],
      showDateLine: true,
    },
    supportedOutputs: ['html', 'pdf'],
  },
];

export class ReportComponentCatalog {
  static getAll(): ReportComponentDefinition[] {
    return [...REPORT_COMPONENT_CATALOG];
  }

  static getByCategory(category: ComponentCategory): ReportComponentDefinition[] {
    return REPORT_COMPONENT_CATALOG.filter((c) => c.category === category);
  }

  static getByType(type: string): ReportComponentDefinition | undefined {
    return REPORT_COMPONENT_CATALOG.find((c) => c.type === type);
  }
}
