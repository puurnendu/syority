/**
 * Metadata-driven navigation. Layouts render from this — never invent menu items.
 */
import { Scope } from './scopes';
import type { Permission } from '@/lib/permissions';

export type NavItemMeta = {
    href: string;
    label: string;
    icon?: string;
    scope: Scope;
    permission?: Permission;
    subLabel?: string;
    children?: NavItemMeta[];
};

export type NavGroupMeta = {
    id: string;
    label: string;
    scope: Scope;
    permission?: Permission;
    items: NavItemMeta[];
};

/** Platform console navigation */
export const PLATFORM_NAV: NavGroupMeta[] = [
    {
        id: 'platform-home',
        label: 'Platform',
        scope: Scope.PLATFORM,
        items: [
            { href: '/platform/dashboard', label: 'Dashboard', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '📊' },
            { href: '/platform/tenants', label: 'Tenants', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🏢' },
            { href: '/platform/onboarding', label: 'Onboarding', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '📝' },
            { href: '/platform/billing', label: 'Licensing & Billing', scope: Scope.PLATFORM, permission: 'nav.billing', icon: '💳' },
            { href: '/platform/users', label: 'Platform Users', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '👥' },
            { href: '/platform/ai-config', label: 'AI Providers', scope: Scope.PLATFORM, permission: 'settings.ai.view', icon: '🤖' },
            { href: '/platform/knowledge', label: 'Knowledge Engine', scope: Scope.PLATFORM, permission: 'knowledge.view', icon: '🧠' },
            { href: '/platform/notifications', label: 'Notifications', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '📧' },
            { href: '/platform/report-builder', label: 'Report Builder', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '📊' },
            { href: '/platform/features', label: 'Feature Flags', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🚩' },
            { href: '/platform/storage', label: 'Storage', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🗄️' },
            { href: '/platform/backups', label: 'Backups', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '💾' },
            { href: '/platform/seed-packs', label: 'Seed Packs', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🌱' },
            { href: '/platform/provisioning-templates', label: 'Provisioning Templates', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🏗️' },
            { href: '/platform/provisioning-jobs', label: 'Provisioning Jobs', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '⚙️' },
            { href: '/platform/reset', label: 'Data Reset', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🗑️' },
            { href: '/platform/operations', label: 'Operations', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🖥️' },
            { href: '/platform/logs', label: 'Logs', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '📜' },
            { href: '/platform/monitoring', label: 'Monitoring', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '📡' },
            { href: '/platform/setup', label: 'Setup / Health', scope: Scope.PLATFORM, permission: 'nav.admin', icon: '🩺' },
        ],
    },
    {
        id: 'platform-data',
        label: 'Global Master Data',
        scope: Scope.PLATFORM,
        items: [
            { href: '/platform-data', label: 'Master Data Hub', scope: Scope.PLATFORM, icon: '📦' },
            { href: '/platform-data/master-data/equipment-types', label: 'Equipment Types', scope: Scope.PLATFORM, icon: '🔧' },
            { href: '/platform-data/master-data/activity-codes', label: 'Activity Codes', scope: Scope.PLATFORM, icon: '#️⃣' },
            { href: '/platform-data/master-data/disciplines', label: 'Disciplines', scope: Scope.PLATFORM, icon: '📐' },
            { href: '/platform-data/master-data/resources', label: 'Resources', scope: Scope.PLATFORM, icon: '👷' },
            { href: '/platform-data/master-data/item-catalog', label: 'Item Catalog', scope: Scope.PLATFORM, icon: '📦' },
            { href: '/platform-data/workpack-templates', label: 'Workpack Templates', scope: Scope.PLATFORM, icon: '📄' },
            { href: '/platform-data/udf-definitions', label: 'UDF Definitions', scope: Scope.PLATFORM, icon: '🧩' },
            { href: '/platform-data/certificate-templates', label: 'Certificate Templates', scope: Scope.PLATFORM, icon: '📜' },
            { href: '/platform-data/print-settings', label: 'Print Settings', scope: Scope.PLATFORM, icon: '🖨️' },
        ],
    },
];

/** Tenant settings sidebar — no platform surfaces */
export const TENANT_SETTINGS_NAV: NavGroupMeta[] = [
    {
        id: 'general',
        label: 'General',
        scope: Scope.TENANT,
        items: [
            { href: '/settings/profile', label: 'My Profile', scope: Scope.TENANT, permission: 'settings.view', icon: '👤' },
            { href: '/settings/notifications', label: 'Notifications', scope: Scope.TENANT, permission: 'settings.view', icon: '🔔' },
        ],
    },
    {
        id: 'organization',
        label: 'Organization',
        scope: Scope.TENANT,
        permission: 'settings.org.view',
        items: [
            { href: '/settings/organization', label: 'Organization Profile', scope: Scope.TENANT, permission: 'settings.org.view', icon: '🏢' },
            { href: '/settings/users', label: 'Users', scope: Scope.TENANT, permission: 'settings.users.view', icon: '👥' },
            { href: '/settings/roles', label: 'Roles & Permissions', scope: Scope.TENANT, permission: 'settings.roles.view', icon: '🔐' },
            { href: '/settings/unit-responsibilities', label: 'Responsibility Matrix', scope: Scope.TENANT, permission: 'settings.org.view', icon: '📋' },
            { href: '/settings/subscription', label: 'License', scope: Scope.TENANT, permission: 'settings.org.view', icon: '📜' },
            { href: '/settings/integrations', label: 'Integrations', scope: Scope.TENANT, permission: 'settings.org.view', icon: '🔗' },
            { href: '/settings/sso', label: 'SSO', scope: Scope.TENANT, permission: 'settings.org.view', icon: '🛡️', subLabel: 'SAML & OIDC' },
            { href: '/settings/audit-logs', label: 'Audit Logs', scope: Scope.TENANT, permission: 'settings.org.view', icon: '📋' },
        ],
    },
    {
        // Separate group so hierarchy nav is not gated by settings.org.view
        id: 'hierarchy',
        label: 'Asset Hierarchy',
        scope: Scope.TENANT,
        items: [
            { href: '/settings/hierarchy/sites', label: 'Sites', scope: Scope.TENANT, permission: 'site.view', icon: '📍' },
            { href: '/settings/hierarchy/plants', label: 'Plants', scope: Scope.TENANT, permission: 'plant.view', icon: '🏭' },
            { href: '/settings/hierarchy/areas', label: 'Areas', scope: Scope.TENANT, permission: 'area.view', icon: '🗺️' },
            { href: '/settings/hierarchy/units', label: 'Units', scope: Scope.TENANT, permission: 'unit.view', icon: '⚙️' },
            { href: '/settings/hierarchy/systems', label: 'Systems', scope: Scope.TENANT, permission: 'system.view', icon: '🔗' },
            { href: '/settings/hierarchy/assets', label: 'Assets', scope: Scope.TENANT, permission: 'asset.view', icon: '🏷️' },
        ],
    },
    {
        id: 'tenant-ai',
        label: 'AI Usage',
        scope: Scope.TENANT,
        permission: 'settings.org.view',
        items: [
            { href: '/settings/ai-prompts', label: 'Prompt Library', scope: Scope.TENANT, permission: 'settings.org.view', icon: '📚' },
            { href: '/settings/ai-logs', label: 'AI Usage Logs', scope: Scope.TENANT, permission: 'settings.org.view', icon: '📈' },
        ],
    },
    {
        id: 'ops-config',
        label: 'Operations Config',
        scope: Scope.TENANT,
        permission: 'settings.org.view',
        items: [
            { href: '/settings/whatsapp', label: 'WhatsApp', scope: Scope.TENANT, permission: 'settings.org.view', icon: '💬' },
            { href: '/settings/calendars', label: 'Working Calendars', scope: Scope.TENANT, permission: 'settings.org.view', icon: '📅' },
            { href: '/settings/certificate-templates', label: 'Certificate Templates', scope: Scope.TENANT, permission: 'settings.templates.view', icon: '📜' },
            { href: '/settings/clearance-parties', label: 'Clearance Parties', scope: Scope.TENANT, permission: 'settings.clearance.view', icon: '✍️' },
            { href: '/settings/items', label: 'Item Catalog', scope: Scope.TENANT, permission: 'masterdata.view', icon: '📦' },
        ],
    },
];

/**
 * Top-level tenant shell groups — the four FROZEN business domains (OD9.2 §21).
 *
 * **The authoritative definition, including every item, permission gate and feature flag, is
 * `src/config/business-navigation.ts`.** This list exists only so the security metadata does
 * not contradict the shell; do not add items here.
 *
 * It previously declared the pre-OD9.2 activity-type shell — Dashboard / Planning / Execution
 * / Intelligence / Import-Export, with a standalone Safety entry and a generic "Reports"
 * group at `/report-builder`. Every part of that is now wrong:
 *
 *   - OD9.2 §21 replaced activity-type grouping with the four business domains below.
 *   - §21 forbids a domain-neutral global Reports menu that obscures ownership; reporting is
 *     owned by its domain (STO reporting sits under STO → STO Reports).
 *   - §22 places Safety under STO → Safety & Permits only, never as a standalone top-level
 *     entry.
 *
 * A prior forensic audit recorded the divergence as defect D-006 ("two navigation
 * architectures", zero consumers) and proposed making the shell read this object. OD9.2
 * resolved it the other way: there is now a single authoritative navigation module, and this
 * metadata follows it.
 */
export const TENANT_SHELL_SECTIONS = [
    { id: 'digital-plant', label: 'Digital Plant', scope: Scope.TENANT },
    { id: 'sto', label: 'STO', scope: Scope.TENANT },
    { id: 'project', label: 'Project', scope: Scope.TENANT },
    { id: 'organization', label: 'Organization & Administration', scope: Scope.TENANT, permission: 'settings.view' as Permission },
] as const;
