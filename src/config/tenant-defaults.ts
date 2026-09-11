/**
 * M7.7 — Tenant Provisioning Default Data
 *
 * Centralized constants for disciplines, equipment types, roles,
 * and module slugs that every new tenant receives on creation.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Disciplines
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_DISCIPLINES = [
  { code: 'MECH', name: 'Mechanical', color: '#3B82F6' },
  { code: 'ELEC', name: 'Electrical', color: '#F59E0B' },
  { code: 'INST', name: 'Instrumentation', color: '#10B981' },
  { code: 'PIPE', name: 'Piping', color: '#6366F1' },
  { code: 'CIVL', name: 'Civil', color: '#8B5CF6' },
  { code: 'HVAC', name: 'HVAC', color: '#EC4899' },
  { code: 'ROTG', name: 'Rotating Equipment', color: '#14B8A6' },
  { code: 'SCAF', name: 'Scaffolding', color: '#F97316' },
  { code: 'INSU', name: 'Insulation', color: '#64748B' },
  { code: 'PNTG', name: 'Painting / Coating', color: '#A855F7' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Equipment Types
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_EQUIPMENT_TYPES = [
  { code: 'PMP', name: 'Centrifugal Pump' },
  { code: 'CMP', name: 'Compressor' },
  { code: 'HEX', name: 'Shell & Tube Heat Exchanger' },
  { code: 'PHE', name: 'Plate Heat Exchanger' },
  { code: 'VES', name: 'Pressure Vessel' },
  { code: 'COL', name: 'Distillation Column' },
  { code: 'REA', name: 'Reactor' },
  { code: 'VLV', name: 'Control Valve' },
  { code: 'PSV', name: 'Pressure Safety Valve' },
  { code: 'TNK', name: 'Storage Tank' },
  { code: 'MTR', name: 'Electric Motor' },
  { code: 'BLR', name: 'Boiler' },
  { code: 'FAN', name: 'Fan / Blower' },
  { code: 'FLT', name: 'Filter' },
  { code: 'DRM', name: 'Drum / Separator' },
  { code: 'FLR', name: 'Flare System' },
  { code: 'CRN', name: 'Crane' },
  { code: 'CNV', name: 'Conveyor' },
  { code: 'GEN', name: 'Generator' },
  { code: 'TRF', name: 'Transformer' },
  { code: 'INS', name: 'Instrument / Transmitter' },
  { code: 'PIP', name: 'Piping Spool' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Default Roles
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_ROLES = [
  { slug: 'tenant_administrator', name: 'Organization Admin' },
  { slug: 'lead_planner', name: 'Planning Manager' },
  { slug: 'scheduler', name: 'Scheduler' },
  { slug: 'planner', name: 'Area Planner' },
  { slug: 'execution_engineer', name: 'Field Engineer' },
  { slug: 'mechanical_engineer', name: 'Execution Engineer' },
  { slug: 'qa_qc_inspector', name: 'QAQC Inspector' },
  { slug: 'safety_officer', name: 'HSE Officer' },
  { slug: 'contractor', name: 'Contractor' },
  { slug: 'viewer', name: 'Viewer' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Module Slugs available for tenant provisioning
// ═══════════════════════════════════════════════════════════════════════════════

export const PROVISIONABLE_MODULES = [
  { slug: 'shutdown_scope', label: 'Shutdown Scope' },
  { slug: 'planner_workspace', label: 'Planning' },
  { slug: 'digital_plant', label: 'Digital Plant' },
  { slug: 'engineering_issues', label: 'Engineering Issues' },
  { slug: 'knowledge_engine', label: 'Knowledge Engine' },
  { slug: 'ois', label: 'OIS' },
  { slug: 'bre', label: 'Business Rules Engine' },
  { slug: 'report_builder', label: 'Report Builder' },
  { slug: 'report_engine', label: 'Report Engine' },
  { slug: 'notification_platform', label: 'Notifications' },
  { slug: 'safety', label: 'Safety Management' },
  { slug: 'asset_register', label: 'Asset Register' },
  { slug: 'workpack_intelligence', label: 'Workpack Intelligence' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Countries, Timezones, Currencies, Industries for wizard dropdowns
// ═══════════════════════════════════════════════════════════════════════════════

export const INDUSTRIES = [
  'Oil & Gas Refinery',
  'Petrochemical',
  'Chemical Processing',
  'Power Generation',
  'LNG / Gas Processing',
  'Mining & Minerals',
  'Pharmaceutical',
  'Water & Wastewater',
  'Pulp & Paper',
  'Steel & Metals',
  'Fertilizer',
  'Cement',
  'Food & Beverage',
  'Other',
] as const;

export const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Houston',
  'Australia/Sydney',
  'Australia/Perth',
  'Africa/Lagos',
  'Africa/Johannesburg',
] as const;

export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'SAR', label: 'Saudi Riyal' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'MYR', label: 'Malaysian Ringgit' },
  { code: 'ZAR', label: 'South African Rand' },
] as const;

export const LICENSE_TYPES = [
  {
    value: 'professional' as const,
    label: 'Professional',
    description: 'Up to 50 users, 10 shutdowns, 50 GB storage',
    defaultSeats: 50,
  },
  {
    value: 'enterprise' as const,
    label: 'Enterprise',
    description: 'Up to 200 users, 50 shutdowns, 200 GB storage',
    defaultSeats: 200,
  },
  {
    value: 'unlimited' as const,
    label: 'Unlimited',
    description: 'No limits on users, shutdowns, or storage',
    defaultSeats: 999999,
  },
] as const;
