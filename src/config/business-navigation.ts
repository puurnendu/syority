import { hasPermission, type Permission } from '@/lib/permissions';
import { TENANT_SHELL_SECTIONS } from '@/security/navigation';

/**
 * AURIANOA BUSINESS-DOMAIN NAVIGATION — OD9.2 §21 (FROZEN)
 *
 * The tenant top-level navigation is organised by BUSINESS DOMAIN, not by activity type.
 * There are exactly four domains, in this order:
 *
 *   1. DIGITAL PLANT                  — asset truth
 *   2. STO                            — shutdown/turnaround truth. Event is the sole STO
 *                                       campaign identity. Safety and Permit Management
 *                                       belong here and ONLY here (§22).
 *   3. PROJECT                        — general-purpose portfolio/project management,
 *                                       independent of STO. Must be enterable without
 *                                       selecting an Event.
 *   4. ORGANIZATION & ADMINISTRATION  — governance and configuration
 *
 * AI / M16 is a cross-domain interaction layer and is deliberately NOT a top-level
 * business domain.
 *
 * This module is intentionally pure so the frozen structure can be verified behaviourally
 * rather than by grepping the layout (OD9.2 §25 forbids relying on source-text tests).
 * It mirrors the existing `src/config/platform-navigation.ts` convention.
 */

export type BusinessDomainKey = 'digital-plant' | 'sto' | 'project' | 'organization';

export type BusinessNavItem = {
  href: string;
  label: string;
  /** Sub-group heading rendered inside the domain dropdown, e.g. STO → "Safety & Permits". */
  section?: string;
};

/** The frozen top-level domain order and labels. */
export const BUSINESS_DOMAINS: { key: BusinessDomainKey; label: string }[] = [
  { key: 'digital-plant', label: 'Digital Plant' },
  { key: 'sto', label: 'STO' },
  { key: 'project', label: 'Project' },
  { key: 'organization', label: 'Organization & Administration' },
];

export type NavGateContext = {
  /** Normalised role string, e.g. `turnaround_manager`. */
  role: string;
  /** Whether a feature flag key is enabled for this tenant. */
  isFeat: (key: string) => boolean;
  /** Contractor tenants do not see plant master data or the full workpack register. */
  isContractorTenant: boolean;
  /** Whether organisation settings are visible (settings permission or proxy session). */
  showAdmin: boolean;
  /** Whether the session may view organisation-level licence/subscription settings. */
  canViewOrgSettings: boolean;
};

// ── 1. DIGITAL PLANT ─────────────────────────────────────────────────────────────

export function buildDigitalPlantItems(ctx: NavGateContext): BusinessNavItem[] {
  const { role, isFeat, isContractorTenant } = ctx;
  return (
    [
      { href: '/digital-plant', label: '🏭 Plant Overview', section: 'Plant Overview' },
      { href: '/asset-register', label: 'Asset Register', section: 'Asset Register' },
      { href: '/engineering-issues', label: '🔧 Scope Intelligence', section: 'Asset Integrity' },
    ] as BusinessNavItem[]
  ).filter((item) => {
    if (item.href === '/asset-register') {
      if (!isFeat('ASSET_REGISTER')) return false;
      if (isContractorTenant) return false;
      return hasPermission(role, 'workpacks.view');
    }
    // Digital Plant surfaces are asset-permission gated.
    return hasPermission(role, 'asset.view');
  });
}

// ── 2. STO ───────────────────────────────────────────────────────────────────────

export function buildStoItems(ctx: NavGateContext): BusinessNavItem[] {
  const { role, isFeat, isContractorTenant } = ctx;
  return (
    [
      { href: '/events', label: 'Events / TAs', section: 'Events' },
      { href: '/shutdown-scope', label: '📋 Shutdown Scope', section: 'Shutdown Scope' },
      { href: '/workpacks', label: 'Workpacks', section: 'Workpacks' },
      { href: '/workpacks/identity-review', label: 'Event Review', section: 'Workpacks' },
      { href: '/workpack-factory', label: '🏭 Workpack Factory', section: 'Workpacks' },
      { href: '/workpack-intelligence', label: '⚡ Workpack Intelligence', section: 'Workpacks' },
      { href: '/planning/templates', label: 'Workpack Templates', section: 'Workpacks' },
      { href: '/planner-workspace', label: '🎯 Planner Workspace', section: 'Planning' },
      { href: '/planning/activities', label: '📊 Spreadsheet WBS Grid', section: 'Planning' },
      { href: '/schedule', label: 'Execution Schedule', section: 'Planning' },
      { href: '/planning/units', label: 'Units', section: 'Planning' },
      { href: '/planning/systems', label: 'Systems', section: 'Planning' },
      { href: '/planning/readiness', label: '🎯 Planning Readiness', section: 'Readiness' },
      // §22 — Safety and Permit Management appear ONLY here, never under Project.
      { href: '/safety', label: 'Safety', section: 'Safety & Permits' },
      { href: '/permits', label: 'Permits / PTW', section: 'Safety & Permits' },
      { href: '/execution', label: '⚡ Field Execution Workspace', section: 'Execution' },
      { href: '/execution/plan-vs-actual', label: '📈 Plan vs. Actual Variance', section: 'Execution' },
      { href: '/execution/lookahead', label: '⏱️ 24h & 72h Lookahead', section: 'Execution' },
      // M12 field mobile. Previously unreachable by any user — it had no navigation entry
      // anywhere. Its own page metadata declares "Mobile Execution | STO", so ownership is
      // unambiguous and it belongs in the frozen STO Execution section.
      { href: '/execution/mobile', label: '📱 Mobile Execution', section: 'Execution' },
      { href: '/constraints', label: 'Constraints', section: 'Execution' },
      { href: '/punch', label: 'Punch List', section: 'Execution' },
      // §9 / §21 — STO reporting is owned by STO. Every M14 report provider category
      // (planning, shutdown, safety, execution, workforce, management, udf) is STO
      // business reporting, so it must not sit in a domain-neutral global Reports menu.
      // M13 / M15 — Event-scoped intelligence. These landings resolve the active
      // workspace Event and forward to /events/[eventId]/control-tower resp.
      // /management-intelligence (or offer an Event picker). M14 reporting below
      // was already in this menu under STO Reports.
      { href: '/control-tower', label: '🗼 Control Tower', section: 'Intelligence' },
      { href: '/management-intelligence', label: '🧠 Management Intelligence', section: 'Intelligence' },
      { href: '/reporting', label: 'Intelligence Dashboard', section: 'STO Reports' },
      { href: '/reports', label: 'Report Center', section: 'STO Reports' },
      { href: '/report-builder', label: 'Report Builder', section: 'STO Reports' },
      { href: '/shift-reports', label: 'Shift Reports', section: 'STO Reports' },
      { href: '/lessons', label: 'Lessons Learned', section: 'STO Reports' },
      { href: '/whatsapp-reviews', label: 'WhatsApp Reviews', section: 'STO Communications' },
    ] as BusinessNavItem[]
  ).filter((item) => {
    // Feature flags
    if (item.href === '/whatsapp-reviews' && !isFeat('WHATSAPP_REVIEWS')) return false;
    if (item.href === '/safety' && !isFeat('SAFETY_MODULE')) return false;

    // Contractor tenants do not get plant master data or the full workpack register.
    if (isContractorTenant && ['/planning/units', '/planning/systems', '/workpacks'].includes(item.href)) {
      return false;
    }

    if (item.href === '/planning/templates') {
      return hasPermission(role, 'settings.templates.view') || hasPermission(role, 'workpacks.create');
    }
    if (item.href === '/planning/units') return hasPermission(role, 'unit:view');
    if (item.href === '/planning/systems') return hasPermission(role, 'system:view');
    if (item.href === '/workpacks/identity-review') {
      return hasPermission(role, 'workpacks.view') && hasPermission(role, 'events.view');
    }
    if (['/reporting', '/reports', '/report-builder', '/shift-reports', '/whatsapp-reviews'].includes(item.href)) {
      return hasPermission(role, 'reporting:view');
    }
    return hasPermission(role, 'workpacks.view');
  });
}

// ── 3. PROJECT ───────────────────────────────────────────────────────────────────

export function buildProjectItems(ctx: NavGateContext): BusinessNavItem[] {
  const { role } = ctx;
  return (
    [
      { href: '/projects/portfolios', label: 'Portfolio Overview', section: 'Portfolio' },
      { href: '/projects', label: 'All Projects', section: 'Projects' },
      // `/imported-schedule` is deliberately NOT linked here. It is a dead-end placeholder
      // ("Please select a project") and M11-R0 removed it from navigation as part of
      // schedule-import deprecation. OD9.2 §10 forbids presenting placeholders as
      // features, and §27 forbids reversing a prior decision without proof.
      //
      // §11 — Primavera P6 / Microsoft Project / Excel schedule interchange is legitimate
      // Project functionality and stays inside the Project domain.
      { href: '/integrations/import', label: 'Import Schedule (P6 / MS Project)', section: 'Import / Export' },
      { href: '/integrations/export', label: 'Export Schedule', section: 'Import / Export' },
      { href: '/integrations/export/history', label: 'Export History', section: 'Import / Export' },
    ] as BusinessNavItem[]
  ).filter((item) => {
    if (item.href === '/projects' || item.href === '/projects/portfolios') {
      return hasPermission(role, 'projects.view');
    }
    return hasPermission(role, 'workpacks.view');
  });
}

// ── 4. ORGANIZATION & ADMINISTRATION ─────────────────────────────────────────────

export function buildOrganizationItems(ctx: NavGateContext): BusinessNavItem[] {
  const { role, isFeat, showAdmin, canViewOrgSettings } = ctx;
  const items: BusinessNavItem[] = [];

  if (hasPermission(role, 'workpacks.view') && isFeat('DOCUMENT_MANAGEMENT')) {
    items.push({ href: '/documents', label: 'Documents', section: 'Documents' });
  }

  if (showAdmin) {
    items.push({ href: '/settings/organization', label: 'Organisation', section: 'Governance' });
    items.push({ href: '/settings/users', label: 'Users', section: 'Governance' });
    items.push({ href: '/settings', label: 'Settings', section: 'Configuration' });
    if (canViewOrgSettings) {
      items.push({ href: '/settings/subscription', label: 'License & Subscription', section: 'Configuration' });
    }
  }

  return items;
}

/** Build all four frozen business domains at once. */
export function buildBusinessNavigation(ctx: NavGateContext): Record<BusinessDomainKey, BusinessNavItem[]> {
  return {
    'digital-plant': buildDigitalPlantItems(ctx),
    sto: buildStoItems(ctx),
    project: buildProjectItems(ctx),
    organization: buildOrganizationItems(ctx),
  };
}

export type TenantShellNavSection = {
  id: BusinessDomainKey;
  label: string;
  items: BusinessNavItem[];
};

const DOMAIN_ITEM_BUILDERS: Record<BusinessDomainKey, (ctx: NavGateContext) => BusinessNavItem[]> = {
  'digital-plant': buildDigitalPlantItems,
  sto: buildStoItems,
  project: buildProjectItems,
  organization: buildOrganizationItems,
};

/**
 * Tenant shell navigation driven by `TENANT_SHELL_SECTIONS` (security metadata).
 * Domain order, labels and permission gates come from that list; item definitions
 * and feature/role filtering remain in the builders above.
 */
export function buildTenantShellNavigation(ctx: NavGateContext): TenantShellNavSection[] {
  return TENANT_SHELL_SECTIONS.flatMap((section) => {
    const id = section.id as BusinessDomainKey;
    const permission = 'permission' in section ? section.permission : undefined;
    if (permission && !ctx.showAdmin && !hasPermission(ctx.role, permission as Permission)) {
      return [];
    }
    const items = DOMAIN_ITEM_BUILDERS[id]?.(ctx) ?? [];
    if (items.length === 0) return [];
    return [{ id, label: section.label, items }];
  });
}
