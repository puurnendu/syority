/**
 * M7.6D — Cockpit Library Service
 *
 * Pre-built dashboard templates organized by domain.
 * Each cockpit maps to a dashboard layout definition with
 * pre-configured widgets, providers, and pages.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CockpitTemplate {
  slug: string;
  name: string;
  description: string;
  category: CockpitCategory;
  icon: string;
  thumbnail: string;
  tags: string[];
  pages: CockpitPage[];
  defaultTheme: 'light' | 'dark';
  defaultRefreshIntervalSec: number;
  supportedModes: Array<'viewer' | 'tv' | 'meeting' | 'pdf'>;
  version: string;
  author: string;
}

export type CockpitCategory =
  | 'planning'
  | 'execution'
  | 'safety'
  | 'workforce'
  | 'shutdown'
  | 'management'
  | 'executive';

export interface CockpitPage {
  title: string;
  icon?: string;
  widgets: CockpitWidgetDef[];
}

export interface CockpitWidgetDef {
  widgetDefinitionSlug: string;
  title: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  providerParams?: Record<string, any>;
  visualizationOverrides?: Record<string, any>;
}

// ─── Built-in Cockpits ─────────────────────────────────────────────────────

export const builtInCockpits: CockpitTemplate[] = [
  // ── Planning Domain ───────────────────────────────────────────────────
  {
    slug: 'planning-overview',
    name: 'Planning Overview',
    description: 'Executive view of schedule status, milestones, critical path, and float distribution.',
    category: 'planning',
    icon: '📊',
    thumbnail: '/cockpits/planning-overview.png',
    tags: ['planning', 'schedule', 'overview'],
    defaultTheme: 'light',
    defaultRefreshIntervalSec: 300,
    supportedModes: ['viewer', 'tv', 'meeting', 'pdf'],
    version: '1.0.0',
    author: 'STO Platform',
    pages: [{
      title: 'Overview',
      widgets: [
        { widgetDefinitionSlug: 'schedule_performance', title: 'Schedule Performance', gridX: 0, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'milestone_tracker', title: 'Milestone Tracker', gridX: 4, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'schedule_health_index', title: 'Health Score', gridX: 8, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'critical_activities', title: 'Critical Path', gridX: 0, gridY: 2, gridW: 6, gridH: 4 },
        { widgetDefinitionSlug: 'float_distribution', title: 'Float Distribution', gridX: 6, gridY: 2, gridW: 3, gridH: 4 },
        { widgetDefinitionSlug: 'late_activities', title: 'Late Activities', gridX: 9, gridY: 2, gridW: 3, gridH: 4 },
        { widgetDefinitionSlug: 'scurve', title: 'S-Curve', gridX: 0, gridY: 6, gridW: 12, gridH: 4 },
      ],
    }],
  },

  {
    slug: '24hr-look-ahead',
    name: '24 Hour Look Ahead',
    description: 'Activities scheduled to start in the next 24 hours.',
    category: 'planning',
    icon: '⏰',
    thumbnail: '/cockpits/24hr-look-ahead.png',
    tags: ['planning', 'lookahead', '24h'],
    defaultTheme: 'light',
    defaultRefreshIntervalSec: 300,
    supportedModes: ['viewer', 'tv', 'meeting', 'pdf'],
    version: '1.0.0',
    author: 'STO Platform',
    pages: [{
      title: '24hr Look Ahead',
      widgets: [
        { widgetDefinitionSlug: 'activity_status_summary', title: "Today's Status", gridX: 0, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'crew_availability', title: 'Crew Available', gridX: 4, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'open_constraints', title: 'Constraint Status', gridX: 8, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'upcoming_milestones', title: 'Upcoming Milestones', gridX: 0, gridY: 2, gridW: 12, gridH: 4 },
      ],
    }],
  },

  // ── Safety Domain ─────────────────────────────────────────────────────
  {
    slug: 'safety-overview',
    name: 'Safety Dashboard',
    description: 'Safety KPIs, incidents, permits, observations, and compliance.',
    category: 'safety',
    icon: '🛡️',
    thumbnail: '/cockpits/safety-overview.png',
    tags: ['safety', 'incidents', 'permits'],
    defaultTheme: 'light',
    defaultRefreshIntervalSec: 60,
    supportedModes: ['viewer', 'tv', 'meeting', 'pdf'],
    version: '1.0.0',
    author: 'STO Platform',
    pages: [
      {
        title: 'KPIs',
        widgets: [
          { widgetDefinitionSlug: 'ai_safety_summary', title: 'Safety Summary', gridX: 0, gridY: 0, gridW: 12, gridH: 2 },
          { widgetDefinitionSlug: 'permit_status', title: 'Permit Status', gridX: 0, gridY: 2, gridW: 4, gridH: 3 },
          { widgetDefinitionSlug: 'safety_observations', title: 'Observations', gridX: 4, gridY: 2, gridW: 4, gridH: 3 },
          { widgetDefinitionSlug: 'unsafe_acts', title: 'Unsafe Acts', gridX: 8, gridY: 2, gridW: 4, gridH: 3 },
        ],
      },
      {
        title: 'Permits',
        icon: '📋',
        widgets: [
          { widgetDefinitionSlug: 'permit_status', title: 'All Permits', gridX: 0, gridY: 0, gridW: 6, gridH: 4 },
          { widgetDefinitionSlug: 'hot_work', title: 'Hot Work', gridX: 6, gridY: 0, gridW: 3, gridH: 2 },
          { widgetDefinitionSlug: 'confined_space', title: 'Confined Space', gridX: 9, gridY: 0, gridW: 3, gridH: 2 },
          { widgetDefinitionSlug: 'work_at_height', title: 'Work at Height', gridX: 6, gridY: 2, gridW: 3, gridH: 2 },
          { widgetDefinitionSlug: 'lifting', title: 'Lifting', gridX: 9, gridY: 2, gridW: 3, gridH: 2 },
        ],
      },
    ],
  },

  // ── Workforce Domain ──────────────────────────────────────────────────
  {
    slug: 'workforce-overview',
    name: 'Workforce Dashboard',
    description: 'Attendance, productivity, manhours, contractor breakdown.',
    category: 'workforce',
    icon: '👷',
    thumbnail: '/cockpits/workforce-overview.png',
    tags: ['workforce', 'attendance', 'manpower'],
    defaultTheme: 'light',
    defaultRefreshIntervalSec: 120,
    supportedModes: ['viewer', 'tv', 'meeting', 'pdf'],
    version: '1.0.0',
    author: 'STO Platform',
    pages: [{
      title: 'Workforce',
      widgets: [
        { widgetDefinitionSlug: 'today_attendance', title: "Today's Headcount", gridX: 0, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'crew_availability', title: 'Availability', gridX: 3, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'overtime', title: 'Overtime', gridX: 6, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'productivity', title: 'Productivity', gridX: 9, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'contractor_attendance', title: 'By Contractor', gridX: 0, gridY: 2, gridW: 4, gridH: 4 },
        { widgetDefinitionSlug: 'discipline_attendance', title: 'By Discipline', gridX: 4, gridY: 2, gridW: 4, gridH: 4 },
        { widgetDefinitionSlug: 'actual_vs_planned', title: 'Actual vs Planned', gridX: 8, gridY: 2, gridW: 4, gridH: 4 },
        { widgetDefinitionSlug: 'manhour_burn', title: 'Manhour Burn', gridX: 0, gridY: 6, gridW: 12, gridH: 4 },
      ],
    }],
  },

  // ── Executive Domain ──────────────────────────────────────────────────
  {
    slug: 'executive-overview',
    name: 'Executive Overview',
    description: 'High-level turnaround progress for executive stakeholders.',
    category: 'executive',
    icon: '🏢',
    thumbnail: '/cockpits/executive-overview.png',
    tags: ['executive', 'management', 'overview'],
    defaultTheme: 'dark',
    defaultRefreshIntervalSec: 600,
    supportedModes: ['viewer', 'tv', 'meeting', 'pdf'],
    version: '1.0.0',
    author: 'STO Platform',
    pages: [{
      title: 'Executive',
      widgets: [
        { widgetDefinitionSlug: 'schedule_performance', title: 'Schedule', gridX: 0, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'schedule_health_index', title: 'Health', gridX: 3, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'today_attendance', title: 'Workforce', gridX: 6, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'ai_safety_summary', title: 'Safety', gridX: 9, gridY: 0, gridW: 3, gridH: 2 },
        { widgetDefinitionSlug: 'milestone_tracker', title: 'Milestones', gridX: 0, gridY: 2, gridW: 6, gridH: 4 },
        { widgetDefinitionSlug: 'earned_value', title: 'EVM', gridX: 6, gridY: 2, gridW: 6, gridH: 4 },
        { widgetDefinitionSlug: 'scurve', title: 'S-Curve', gridX: 0, gridY: 6, gridW: 12, gridH: 4 },
      ],
    }],
  },

  // ── Shutdown Domain ───────────────────────────────────────────────────
  {
    slug: 'shutdown-overview',
    name: 'Shutdown Overview',
    description: 'Scope management, readiness, and commissioning status.',
    category: 'shutdown',
    icon: '🔧',
    thumbnail: '/cockpits/shutdown-overview.png',
    tags: ['shutdown', 'scope', 'readiness'],
    defaultTheme: 'light',
    defaultRefreshIntervalSec: 300,
    supportedModes: ['viewer', 'tv', 'meeting', 'pdf'],
    version: '1.0.0',
    author: 'STO Platform',
    pages: [{
      title: 'Shutdown',
      widgets: [
        { widgetDefinitionSlug: 'schedule_performance', title: 'Progress', gridX: 0, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'ready_workpacks', title: 'Ready Workpacks', gridX: 4, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'waiting_workpacks', title: 'Waiting', gridX: 8, gridY: 0, gridW: 4, gridH: 2 },
        { widgetDefinitionSlug: 'resource_loading', title: 'Resource Loading', gridX: 0, gridY: 2, gridW: 6, gridH: 4 },
        { widgetDefinitionSlug: 'unassigned_work', title: 'Unassigned', gridX: 6, gridY: 2, gridW: 6, gridH: 4 },
      ],
    }],
  },
];

// ─── Service ────────────────────────────────────────────────────────────────

export class CockpitLibraryService {
  private cockpits: Map<string, CockpitTemplate> = new Map();

  constructor() {
    builtInCockpits.forEach((c) => this.cockpits.set(c.slug, c));
  }

  getAll(): CockpitTemplate[] {
    return Array.from(this.cockpits.values());
  }

  getByCategory(category: CockpitCategory): CockpitTemplate[] {
    return this.getAll().filter((c) => c.category === category);
  }

  get(slug: string): CockpitTemplate | undefined {
    return this.cockpits.get(slug);
  }

  search(query: string): CockpitTemplate[] {
    const q = query.toLowerCase();
    return this.getAll().filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q))
    );
  }

  register(template: CockpitTemplate) {
    this.cockpits.set(template.slug, template);
  }
}
