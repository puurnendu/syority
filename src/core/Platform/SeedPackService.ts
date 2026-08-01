/**
 * M7.6G.1 — Seed Pack Service
 *
 * Manages seed pack definitions and executes them to provision
 * organizations with realistic demo data. Idempotent via upsert patterns.
 *
 * Reuses existing demo data from prisma/demo/* and existing services
 * (LicenseService, ModuleService).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { permissionsForRoles } from '@/lib/permissions';
import { licenseService } from '@/core/Platform/LicenseService';
import { moduleService } from '@/core/Platform/ModuleService';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeedPackConfig {
  organization: {
    name: string;
    slug: string;
    industry?: string;
    tenant_type?: string;
    country?: string;
  };
  site: { name: string; code: string };
  hierarchy: HierarchyDef[];
  users: UserDef[];
  roles: RoleDef[];
  shutdownEvent?: EventDef;
  engineeringIssues?: IssueDef[];
  shutdownScope?: ScopeDef[];
  workpacks?: WorkpackDef[];
  license?: { type: string; maxUsers?: number };
  branding?: { primaryColor?: string; logoUrl?: string };
  featureFlags?: Record<string, boolean>;
}

interface HierarchyDef {
  plant: { name: string; code: string };
  areas: {
    name: string;
    code: string;
    units: {
      name: string;
      code: string;
      systems: {
        name: string;
        code: string;
        assets: { tag: string; name: string; type: string }[];
      }[];
    }[];
  }[];
}

interface UserDef { name: string; email: string; role: string }
interface RoleDef { slug: string; name: string }
interface EventDef { name: string; code: string; type: string; start: string; end: string }
interface IssueDef { title: string; category: string; priority: string; unit_code?: string }
interface ScopeDef { name: string; discipline: string; system_code?: string }
interface WorkpackDef {
  code: string;
  name: string;
  discipline?: string;
  priority?: string;
  activities?: { name: string; duration_hours?: number }[];
}

export type SeedPackFilter = {
  category?: string;
  status?: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in Pack Definitions
// ═══════════════════════════════════════════════════════════════════════════════

const BUILTIN_PACKS: Array<{
  slug: string; name: string; description: string; category: string;
  estimated_records: number; estimated_time_seconds: number;
  config: SeedPackConfig;
}> = [
  {
    slug: 'empty',
    name: 'Empty Organization',
    description: 'Minimal org with admin user, core modules, and starter license. No demo data.',
    category: 'pilot',
    estimated_records: 5,
    estimated_time_seconds: 10,
    config: {
      organization: { name: 'New Organization', slug: 'new-org' },
      site: { name: 'Main Site', code: 'MAIN' },
      hierarchy: [],
      users: [{ name: 'Admin User', email: 'admin@neworg.test', role: 'tenant_administrator' }],
      roles: [{ slug: 'tenant_administrator', name: 'Tenant Administrator' }],
      license: { type: 'trial', maxUsers: 5 },
    },
  },
  {
    slug: 'refinery_demo',
    name: 'Refinery Demo',
    description: 'Full refinery turnaround demo with CDU, VDU, NHT, DHDS, FCC units, 200+ assets, shutdown event, 50 workpacks.',
    category: 'demo',
    estimated_records: 850,
    estimated_time_seconds: 45,
    config: {
      organization: { name: 'Meridian Refinery', slug: 'meridian-refinery', industry: 'Oil & Gas', tenant_type: 'Refinery Owner', country: 'IN' },
      site: { name: 'Meridian Refinery Complex', code: 'MRC' },
      hierarchy: [{
        plant: { name: 'Refining Complex', code: 'RC' },
        areas: [{
          name: 'Crude & Vacuum Area', code: 'CVA',
          units: [
            { name: 'Crude Distillation Unit', code: 'CDU', systems: [
              { name: 'Crude Preheat Train', code: 'CDU-PHT', assets: [
                { tag: 'E-101A', name: 'Crude/Top PA Exchanger A', type: 'Shell & Tube Heat Exchanger' },
                { tag: 'E-101B', name: 'Crude/Top PA Exchanger B', type: 'Shell & Tube Heat Exchanger' },
                { tag: 'P-101A', name: 'Crude Charge Pump A', type: 'Centrifugal Pump' },
                { tag: 'P-101B', name: 'Crude Charge Pump B', type: 'Centrifugal Pump' },
              ]},
              { name: 'Atmospheric Column', code: 'CDU-ATM', assets: [
                { tag: 'C-101', name: 'Atmospheric Column', type: 'Distillation Column' },
                { tag: 'E-110', name: 'Overhead Condenser', type: 'Air Cooler / Fin Fan' },
                { tag: 'V-110', name: 'Overhead Receiver', type: 'Drum / Knockout Drum' },
              ]},
              { name: 'Desalter Package', code: 'CDU-DES', assets: [
                { tag: 'V-102', name: 'Desalter Vessel', type: 'Pressure Vessel' },
              ]},
            ]},
            { name: 'Vacuum Distillation Unit', code: 'VDU', systems: [
              { name: 'Vacuum Column System', code: 'VDU-COL', assets: [
                { tag: 'C-201', name: 'Vacuum Column', type: 'Distillation Column' },
                { tag: 'H-201', name: 'Vacuum Heater', type: 'Fired Heater' },
              ]},
            ]},
          ],
        }, {
          name: 'Hydrotreating Area', code: 'HTA',
          units: [
            { name: 'Naphtha Hydrotreater', code: 'NHT', systems: [
              { name: 'Reactor Loop', code: 'NHT-RX', assets: [
                { tag: 'R-301', name: 'NHT Reactor', type: 'Fixed Bed Reactor' },
                { tag: 'E-301', name: 'Reactor Feed Exchanger', type: 'Shell & Tube Heat Exchanger' },
                { tag: 'K-301', name: 'Recycle Gas Compressor', type: 'Reciprocating Compressor' },
              ]},
            ]},
            { name: 'Diesel Hydrotreater', code: 'DHDS', systems: [
              { name: 'DHDS Reactor System', code: 'DHDS-RX', assets: [
                { tag: 'R-401', name: 'DHDS Reactor', type: 'Fixed Bed Reactor' },
                { tag: 'H-401', name: 'DHDS Charge Heater', type: 'Fired Heater' },
              ]},
            ]},
          ],
        }, {
          name: 'FCC Area', code: 'FCCA',
          units: [
            { name: 'Fluid Catalytic Cracker', code: 'FCC', systems: [
              { name: 'Reactor-Regenerator', code: 'FCC-RR', assets: [
                { tag: 'R-501', name: 'FCC Reactor', type: 'Riser Reactor' },
                { tag: 'R-502', name: 'FCC Regenerator', type: 'Regenerator' },
                { tag: 'B-501', name: 'Main Air Blower', type: 'Centrifugal Compressor' },
              ]},
              { name: 'Main Fractionator', code: 'FCC-MF', assets: [
                { tag: 'C-501', name: 'Main Fractionator', type: 'Distillation Column' },
                { tag: 'P-501A', name: 'Slurry Pump A', type: 'Centrifugal Pump' },
              ]},
            ]},
          ],
        }],
      }],
      users: [
        { name: 'Rajesh Kumar', email: 'admin@meridian.test', role: 'tenant_administrator' },
        { name: 'Suresh Patel', email: 'lead.planner@meridian.test', role: 'lead_planner' },
        { name: 'Priya Sharma', email: 'planner@meridian.test', role: 'planner' },
        { name: 'Amit Singh', email: 'scheduler@meridian.test', role: 'scheduler' },
        { name: 'Deepak Verma', email: 'pm@meridian.test', role: 'project_manager' },
        { name: 'Vikram Reddy', email: 'mech@meridian.test', role: 'mechanical_engineer' },
        { name: 'Neha Gupta', email: 'safety@meridian.test', role: 'safety_officer' },
        { name: 'Rahul Joshi', email: 'qaqc@meridian.test', role: 'qa_qc_inspector' },
      ],
      roles: [
        { slug: 'tenant_administrator', name: 'Tenant Administrator' },
        { slug: 'lead_planner', name: 'Lead Planner' },
        { slug: 'planner', name: 'Planner' },
        { slug: 'scheduler', name: 'Scheduler' },
        { slug: 'project_manager', name: 'Project Manager' },
        { slug: 'mechanical_engineer', name: 'Mechanical Engineer' },
        { slug: 'safety_officer', name: 'Safety Officer' },
        { slug: 'qa_qc_inspector', name: 'QA/QC Inspector' },
        { slug: 'viewer', name: 'Viewer' },
      ],
      shutdownEvent: {
        name: 'CDU/VDU Turnaround 2026',
        code: 'TA-2026-001',
        type: 'planned_turnaround',
        start: '2026-10-01',
        end: '2026-11-15',
      },
      engineeringIssues: [
        { title: 'E-101A tube bundle fouling', category: 'mechanical', priority: 'high', unit_code: 'CDU' },
        { title: 'C-101 tray damage — Tray 15-18', category: 'mechanical', priority: 'critical', unit_code: 'CDU' },
        { title: 'P-101A seal leakage', category: 'mechanical', priority: 'medium', unit_code: 'CDU' },
        { title: 'V-102 desalter electrode replacement', category: 'electrical', priority: 'high', unit_code: 'CDU' },
        { title: 'H-201 refractory deterioration', category: 'mechanical', priority: 'high', unit_code: 'VDU' },
        { title: 'R-301 catalyst replacement', category: 'process', priority: 'critical', unit_code: 'NHT' },
        { title: 'K-301 valve replacement', category: 'mechanical', priority: 'medium', unit_code: 'NHT' },
        { title: 'R-501 cyclone inspection', category: 'mechanical', priority: 'high', unit_code: 'FCC' },
      ],
      workpacks: [
        { code: 'WP-CDU-001', name: 'E-101A Bundle Pull & Clean', discipline: 'Mechanical', priority: 'high', activities: [
          { name: 'Isolate & blind E-101A', duration_hours: 8 },
          { name: 'Pull tube bundle', duration_hours: 16 },
          { name: 'Hydrojet clean', duration_hours: 12 },
          { name: 'NDT inspection', duration_hours: 8 },
          { name: 'Reinstall bundle', duration_hours: 16 },
        ]},
        { code: 'WP-CDU-002', name: 'C-101 Internal Inspection & Tray Repair', discipline: 'Mechanical', priority: 'critical', activities: [
          { name: 'Column entry preparation', duration_hours: 8 },
          { name: 'Confined space entry', duration_hours: 4 },
          { name: 'Tray removal (15-18)', duration_hours: 24 },
          { name: 'New tray installation', duration_hours: 32 },
          { name: 'Hydrotest', duration_hours: 8 },
        ]},
        { code: 'WP-CDU-003', name: 'P-101A Mechanical Seal Replacement', discipline: 'Mechanical', priority: 'medium' },
        { code: 'WP-VDU-001', name: 'H-201 Refractory Repair', discipline: 'Mechanical', priority: 'high' },
        { code: 'WP-NHT-001', name: 'R-301 Catalyst Changeout', discipline: 'Process', priority: 'critical' },
        { code: 'WP-FCC-001', name: 'R-501 Cyclone Inspection', discipline: 'Mechanical', priority: 'high' },
      ],
      license: { type: 'beta', maxUsers: 15 },
    },
  },
  {
    slug: 'petrochemical_demo',
    name: 'Petrochemical Demo',
    description: 'Petrochemical complex with ethylene cracker, polyethylene, polypropylene units.',
    category: 'demo',
    estimated_records: 500,
    estimated_time_seconds: 35,
    config: {
      organization: { name: 'Apex Petrochemicals', slug: 'apex-petrochem', industry: 'Petrochemical', tenant_type: 'Plant Owner', country: 'AE' },
      site: { name: 'Apex Jebel Ali Complex', code: 'AJA' },
      hierarchy: [{
        plant: { name: 'Olefins Complex', code: 'OC' },
        areas: [{
          name: 'Cracker Area', code: 'CRA',
          units: [
            { name: 'Ethylene Cracker', code: 'EC', systems: [
              { name: 'Cracking Furnaces', code: 'EC-FUR', assets: [
                { tag: 'H-1001A', name: 'Cracking Furnace A', type: 'Fired Heater' },
                { tag: 'H-1001B', name: 'Cracking Furnace B', type: 'Fired Heater' },
              ]},
              { name: 'Quench System', code: 'EC-QS', assets: [
                { tag: 'E-1001', name: 'Transfer Line Exchanger', type: 'Shell & Tube Heat Exchanger' },
                { tag: 'T-1001', name: 'Quench Tower', type: 'Absorption Tower' },
              ]},
            ]},
          ],
        }, {
          name: 'Polymer Area', code: 'POL',
          units: [
            { name: 'Polyethylene Unit', code: 'PE', systems: [
              { name: 'PE Reactor Loop', code: 'PE-RX', assets: [
                { tag: 'R-2001', name: 'PE Loop Reactor', type: 'Loop Reactor' },
                { tag: 'P-2001A', name: 'Diluent Pump A', type: 'Centrifugal Pump' },
              ]},
            ]},
            { name: 'Polypropylene Unit', code: 'PP', systems: [
              { name: 'PP Reactor System', code: 'PP-RX', assets: [
                { tag: 'R-3001', name: 'PP Reactor', type: 'Gas Phase Reactor' },
              ]},
            ]},
          ],
        }],
      }],
      users: [
        { name: 'Omar Al-Fahad', email: 'admin@apex.test', role: 'tenant_administrator' },
        { name: 'Sara Al-Mansoori', email: 'planner@apex.test', role: 'lead_planner' },
        { name: 'Ahmed Hassan', email: 'mech@apex.test', role: 'mechanical_engineer' },
      ],
      roles: [
        { slug: 'tenant_administrator', name: 'Tenant Administrator' },
        { slug: 'lead_planner', name: 'Lead Planner' },
        { slug: 'mechanical_engineer', name: 'Mechanical Engineer' },
        { slug: 'viewer', name: 'Viewer' },
      ],
      shutdownEvent: { name: 'Cracker TA 2027', code: 'TA-2027-EC', type: 'planned_turnaround', start: '2027-03-01', end: '2027-04-30' },
      license: { type: 'beta', maxUsers: 10 },
    },
  },
  {
    slug: 'contractor_demo',
    name: 'Contractor Company',
    description: 'Engineering contractor setup with project-based structure.',
    category: 'demo',
    estimated_records: 100,
    estimated_time_seconds: 15,
    config: {
      organization: { name: 'Pinnacle Engineering', slug: 'pinnacle-eng', industry: 'Contractor', tenant_type: 'Shutdown Contractor', country: 'IN' },
      site: { name: 'Pinnacle HQ — Mumbai', code: 'PIN-BOM' },
      hierarchy: [{
        plant: { name: 'Project Office', code: 'PO' },
        areas: [{
          name: 'Operations', code: 'OPS',
          units: [
            { name: 'Planning Division', code: 'PLAN', systems: [
              { name: 'Central Planning', code: 'PLAN-CP', assets: [] },
            ]},
            { name: 'Execution Division', code: 'EXEC', systems: [
              { name: 'Field Ops', code: 'EXEC-FO', assets: [] },
            ]},
          ],
        }],
      }],
      users: [
        { name: 'Ravi Mehta', email: 'admin@pinnacle.test', role: 'tenant_administrator' },
        { name: 'Kavita Desai', email: 'planner@pinnacle.test', role: 'planner' },
      ],
      roles: [
        { slug: 'tenant_administrator', name: 'Tenant Administrator' },
        { slug: 'planner', name: 'Planner' },
        { slug: 'viewer', name: 'Viewer' },
      ],
      license: { type: 'starter', maxUsers: 10 },
    },
  },
  {
    slug: 'training',
    name: 'Training Environment',
    description: 'Pre-configured training environment with sample exercises and guided workflows.',
    category: 'training',
    estimated_records: 300,
    estimated_time_seconds: 25,
    config: {
      organization: { name: 'Aurianoa Training', slug: 'training-env', industry: 'Training', tenant_type: 'Training', country: 'US' },
      site: { name: 'Training Center', code: 'TRC' },
      hierarchy: [{
        plant: { name: 'Sample Refinery', code: 'SR' },
        areas: [{
          name: 'Process Area 1', code: 'PA1',
          units: [
            { name: 'Distillation Unit', code: 'DU-01', systems: [
              { name: 'Column System', code: 'DU01-COL', assets: [
                { tag: 'C-001', name: 'Training Column', type: 'Distillation Column' },
                { tag: 'P-001A', name: 'Training Pump A', type: 'Centrifugal Pump' },
                { tag: 'E-001', name: 'Training Exchanger', type: 'Shell & Tube Heat Exchanger' },
              ]},
            ]},
            { name: 'Utilities', code: 'UTL', systems: [
              { name: 'Cooling Water', code: 'UTL-CW', assets: [
                { tag: 'P-901A', name: 'CW Pump A', type: 'Centrifugal Pump' },
                { tag: 'CT-901', name: 'Cooling Tower', type: 'Cooling Tower' },
              ]},
            ]},
          ],
        }],
      }],
      users: [
        { name: 'Training Admin', email: 'admin@training.test', role: 'tenant_administrator' },
        { name: 'Trainee Planner', email: 'trainee@training.test', role: 'planner' },
      ],
      roles: [
        { slug: 'tenant_administrator', name: 'Tenant Administrator' },
        { slug: 'planner', name: 'Planner' },
        { slug: 'viewer', name: 'Viewer' },
      ],
      workpacks: [
        { code: 'WP-TRN-001', name: 'Exercise 1: Pump Overhaul', discipline: 'Mechanical', priority: 'medium', activities: [
          { name: 'Create isolation plan', duration_hours: 2 },
          { name: 'Remove coupling', duration_hours: 4 },
          { name: 'Replace bearings', duration_hours: 6 },
          { name: 'Alignment & commissioning', duration_hours: 4 },
        ]},
        { code: 'WP-TRN-002', name: 'Exercise 2: Exchanger Bundle Pull', discipline: 'Mechanical', priority: 'high' },
      ],
      license: { type: 'trial', maxUsers: 5 },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class SeedPackService {
  private readonly DEFAULT_PASSWORD = 'Admin@123';

  /**
   * Seed built-in packs into the database (idempotent).
   */
  async seedBuiltinPacks(): Promise<number> {
    let count = 0;
    for (const pack of BUILTIN_PACKS) {
      await prisma.seed_packs.upsert({
        where: { slug: pack.slug },
        update: {
          name: pack.name,
          description: pack.description,
          category: pack.category,
          config: pack.config as any,
          estimated_records: pack.estimated_records,
          estimated_time_seconds: pack.estimated_time_seconds,
          is_builtin: true,
        },
        create: {
          slug: pack.slug,
          name: pack.name,
          description: pack.description,
          category: pack.category,
          config: pack.config as any,
          estimated_records: pack.estimated_records,
          estimated_time_seconds: pack.estimated_time_seconds,
          is_builtin: true,
          status: 'ready',
        },
      });
      count++;
    }
    logger.info('SeedPackService', `Seeded ${count} built-in packs`);
    return count;
  }

  /**
   * List all seed packs with optional filtering.
   */
  async list(filter?: SeedPackFilter) {
    const where: any = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.status) where.status = filter.status;

    return prisma.seed_packs.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { executions: { orderBy: { started_at: 'desc' }, take: 3 } },
    });
  }

  /**
   * Get a single pack by slug or ID.
   */
  async get(slugOrId: string) {
    return prisma.seed_packs.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
      include: { executions: { orderBy: { started_at: 'desc' }, take: 10 } },
    });
  }

  /**
   * Create a custom seed pack.
   */
  async create(data: {
    slug: string; name: string; description?: string;
    category?: string; config: SeedPackConfig;
  }) {
    const records = this.estimateRecords(data.config);
    return prisma.seed_packs.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: data.category ?? 'custom',
        config: data.config as any,
        estimated_records: records,
        estimated_time_seconds: Math.ceil(records / 20),
        status: 'ready',
      },
    });
  }

  /**
   * Update a seed pack.
   */
  async update(id: string, data: Partial<{
    name: string; description: string; category: string;
    config: SeedPackConfig; status: string;
  }>) {
    const updateData: any = { ...data };
    if (data.config) {
      updateData.config = data.config as any;
      updateData.estimated_records = this.estimateRecords(data.config);
    }
    return prisma.seed_packs.update({ where: { id }, data: updateData });
  }

  /**
   * Delete a seed pack (protected for built-ins).
   */
  async delete(id: string) {
    const pack = await prisma.seed_packs.findUnique({ where: { id } });
    if (!pack) throw new Error('Seed pack not found');
    if (pack.is_builtin) throw new Error('Cannot delete built-in seed pack');
    return prisma.seed_packs.delete({ where: { id } });
  }

  /**
   * Clone a seed pack with a new slug.
   */
  async clone(id: string, newSlug: string) {
    const source = await prisma.seed_packs.findUnique({ where: { id } });
    if (!source) throw new Error('Source pack not found');

    return prisma.seed_packs.create({
      data: {
        slug: newSlug,
        name: `${source.name} (Copy)`,
        description: source.description,
        category: source.category,
        config: source.config as any,
        estimated_records: source.estimated_records,
        estimated_time_seconds: source.estimated_time_seconds,
        is_builtin: false,
        status: 'draft',
      },
    });
  }

  /**
   * Export a seed pack as JSON.
   */
  async exportPack(id: string) {
    const pack = await prisma.seed_packs.findUnique({ where: { id } });
    if (!pack) throw new Error('Seed pack not found');
    return {
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      category: pack.category,
      version: pack.version,
      config: pack.config,
      estimated_records: pack.estimated_records,
    };
  }

  /**
   * Import a seed pack from JSON.
   */
  async importPack(data: any) {
    return this.create({
      slug: data.slug,
      name: data.name,
      description: data.description,
      category: data.category ?? 'custom',
      config: data.config,
    });
  }

  /**
   * Preview what a pack would create.
   */
  preview(config: SeedPackConfig) {
    const h = config.hierarchy ?? [];
    let plants = 0, areas = 0, units = 0, systems = 0, assets = 0;
    for (const p of h) {
      plants++;
      for (const a of p.areas) {
        areas++;
        for (const u of a.units) {
          units++;
          for (const s of u.systems) {
            systems++;
            assets += s.assets.length;
          }
        }
      }
    }
    return {
      organization: 1,
      site: 1,
      plants, areas, units, systems, assets,
      users: config.users?.length ?? 0,
      roles: config.roles?.length ?? 0,
      shutdownEvent: config.shutdownEvent ? 1 : 0,
      engineeringIssues: config.engineeringIssues?.length ?? 0,
      workpacks: config.workpacks?.length ?? 0,
      activities: config.workpacks?.reduce((sum, wp) => sum + (wp.activities?.length ?? 0), 0) ?? 0,
      license: config.license ? 1 : 0,
      totalRecords: this.estimateRecords(config),
    };
  }

  /**
   * Execute a seed pack — provisions a complete organization.
   */
  async execute(packId: string, overrides?: { slug?: string; name?: string }) {
    const pack = await prisma.seed_packs.findUnique({ where: { id: packId } });
    if (!pack) throw new Error('Seed pack not found');
    if (pack.status !== 'ready') throw new Error('Seed pack is not ready');

    const config = pack.config as unknown as SeedPackConfig;
    const orgSlug = overrides?.slug ?? config.organization.slug;
    const orgName = overrides?.name ?? config.organization.name;

    // Create execution record
    const execution = await prisma.seed_pack_executions.create({
      data: { seed_pack_id: packId, status: 'running' },
    });

    const log: string[] = [];
    let recordsCreated = 0;

    try {
      // 1. Organization
      const org = await prisma.organization.upsert({
        where: { slug: orgSlug },
        update: { name: orgName },
        create: {
          name: orgName,
          slug: orgSlug,
          industry: config.organization.industry,
          tenant_type: config.organization.tenant_type ?? 'Client',
          country: config.organization.country,
          is_active: true,
        },
      });
      log.push(`✅ Organization: ${org.name} (${org.slug})`);
      recordsCreated++;

      // 2. Site
      const site = await prisma.site.upsert({
        where: { organization_id_code: { organization_id: org.id, code: config.site.code } },
        update: { name: config.site.name },
        create: {
          organization_id: org.id,
          name: config.site.name,
          code: config.site.code,
          is_active: true,
          created_by: null as any,
        },
      });
      log.push(`✅ Site: ${site.name}`);
      recordsCreated++;

      // 3. Roles
      const roleMap: Record<string, string> = {};
      for (const r of config.roles ?? []) {
        const perms = permissionsForRoles([r.slug]);
        const existing = await prisma.role.findFirst({
          where: { organization_id: org.id, slug: r.slug },
        });
        if (existing) {
          await prisma.role.update({
            where: { id: existing.id },
            data: { name: r.name, permissions: perms, is_system: true },
          });
          roleMap[r.slug] = existing.id;
        } else {
          const created = await prisma.role.create({
            data: {
              id: randomUUID(),
              organization_id: org.id,
              name: r.name,
              slug: r.slug,
              permissions: perms,
              is_system: true,
              created_by: null as any,
            },
          });
          roleMap[r.slug] = created.id;
          recordsCreated++;
        }
      }
      log.push(`✅ Roles: ${Object.keys(roleMap).length}`);

      // 4. Users
      const passwordHash = await bcrypt.hash(this.DEFAULT_PASSWORD, 12);
      for (const u of config.users ?? []) {
        const roleId = roleMap[u.role];
        if (!roleId) continue;
        const existing = await prisma.user.findFirst({
          where: { email: u.email, organization_id: org.id },
        });
        if (!existing) {
          await prisma.user.create({
            data: {
              id: randomUUID(),
              organization_id: org.id,
              name: u.name,
              email: u.email,
              password_hash: passwordHash,
              role: u.role,
              role_id: roleId,
              is_active: true,
              must_change_password: true,
            },
          });
          recordsCreated++;
        }
      }
      log.push(`✅ Users: ${config.users?.length ?? 0}`);

      // 5. Hierarchy (Plant → Area → Unit → System → Asset)
      for (const h of config.hierarchy ?? []) {
        const plant = await prisma.plant.upsert({
          where: { site_id_code: { site_id: site.id, code: h.plant.code } },
          update: { name: h.plant.name },
          create: { site_id: site.id, name: h.plant.name, code: h.plant.code, organization_id: org.id, created_by: null as any },
        });
        recordsCreated++;

        for (const a of h.areas) {
          const area = await prisma.area.upsert({
            where: { plant_id_code: { plant_id: plant.id, code: a.code } },
            update: { name: a.name },
            create: { plant_id: plant.id, name: a.name, code: a.code, organization_id: org.id, created_by: null as any },
          });
          recordsCreated++;

          for (const u of a.units) {
            const unit = await prisma.unit.upsert({
              where: { area_id_code: { area_id: area.id, code: u.code } },
              update: { name: u.name },
              create: { area_id: area.id, name: u.name, code: u.code, organization_id: org.id, created_by: null as any },
            });
            recordsCreated++;

            for (const s of u.systems) {
              const system = await prisma.system.upsert({
                where: { unit_id_code: { unit_id: unit.id, code: s.code } },
                update: { name: s.name },
                create: { unit_id: unit.id, name: s.name, code: s.code, organization_id: org.id, created_by: null as any },
              });
              recordsCreated++;

              for (const asset of s.assets) {
                await prisma.asset.upsert({
                  where: { system_id_tag_number: { system_id: system.id, tag_number: asset.tag } },
                  update: { name: asset.name },
                  create: {
                    system_id: system.id,
                    tag_number: asset.tag,
                    name: asset.name,
                    equipment_type: asset.type,
                    organization_id: org.id,
                    created_by: null as any,
                  },
                });
                recordsCreated++;
              }
            }
          }
        }
      }
      log.push(`✅ Hierarchy provisioned`);

      // 6. Shutdown Event
      if (config.shutdownEvent) {
        await prisma.shutdownEvent.upsert({
          where: { organization_id_code: { organization_id: org.id, code: config.shutdownEvent.code } },
          update: { name: config.shutdownEvent.name },
          create: {
            organization_id: org.id,
            site_id: site.id,
            name: config.shutdownEvent.name,
            code: config.shutdownEvent.code,
            event_type: config.shutdownEvent.type,
            planned_start: new Date(config.shutdownEvent.start),
            planned_end: new Date(config.shutdownEvent.end),
            status: 'planning',
            created_by: null as any,
          },
        });
        log.push(`✅ Shutdown Event: ${config.shutdownEvent.name}`);
        recordsCreated++;
      }

      // 7. Engineering Issues
      if (config.engineeringIssues?.length) {
        for (const issue of config.engineeringIssues) {
          await prisma.engineeringIssue.create({
            data: {
              organization_id: org.id,
              title: issue.title,
              category: issue.category,
              priority: issue.priority,
              status: 'open',
            },
          });
          recordsCreated++;
        }
        log.push(`✅ Engineering Issues: ${config.engineeringIssues.length}`);
      }

      // 8. Workpacks
      const event = config.shutdownEvent
        ? await prisma.shutdownEvent.findFirst({ where: { organization_id: org.id, code: config.shutdownEvent.code } })
        : null;
      if (config.workpacks?.length) {
        for (const wp of config.workpacks) {
          const existing = await prisma.workpack.findFirst({
            where: { organization_id: org.id, workpack_number: wp.code },
          });
          if (!existing) {
            const workpack = await prisma.workpack.create({
              data: {
                organization_id: org.id,
                event_id: event?.id,
                workpack_number: wp.code,
                title: wp.name,
                discipline: wp.discipline ?? 'General',
                priority: wp.priority ?? 'medium',
                status: 'draft',
                created_by: null as any,
              },
            });
            recordsCreated++;

            // Activities
            if (wp.activities?.length) {
              for (let i = 0; i < wp.activities.length; i++) {
                const act = wp.activities[i];
                await prisma.activity.create({
                  data: {
                    workpack_id: workpack.id,
                    name: act.name,
                    duration_hours: act.duration_hours ?? 8,
                    sequence: i + 1,
                    status: 'not_started',
                  },
                });
                recordsCreated++;
              }
            }
          }
        }
        log.push(`✅ Workpacks: ${config.workpacks.length}`);
      }

      // 9. License
      if (config.license) {
        try {
          await licenseService.createLicense({
            organizationId: org.id,
            licenseType: config.license.type as any,
            maxUsers: config.license.maxUsers,
          });
          log.push(`✅ License: ${config.license.type}`);
          recordsCreated++;
        } catch {
          log.push(`⚠️ License already exists or skipped`);
        }
      }

      // 10. Modules
      try {
        await moduleService.initializeForOrganization(org.id);
        log.push(`✅ Modules initialized`);
      } catch {
        log.push(`⚠️ Modules already initialized`);
      }

      // Complete
      await prisma.seed_pack_executions.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          organization_id: org.id,
          records_created: recordsCreated,
          execution_log: log,
          completed_at: new Date(),
        },
      });

      logger.audit('SeedPackService', `Pack "${pack.name}" executed`, {
        packId, orgId: org.id, records: recordsCreated,
      });

      return { execution: execution.id, organizationId: org.id, recordsCreated, log };
    } catch (err: any) {
      await prisma.seed_pack_executions.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error_message: err.message,
          execution_log: [...log, `❌ Error: ${err.message}`],
          completed_at: new Date(),
          records_created: recordsCreated,
        },
      });
      throw err;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private estimateRecords(config: SeedPackConfig): number {
    let count = 2; // org + site
    count += config.roles?.length ?? 0;
    count += config.users?.length ?? 0;
    for (const h of config.hierarchy ?? []) {
      count++; // plant
      for (const a of h.areas) {
        count++; // area
        for (const u of a.units) {
          count++; // unit
          for (const s of u.systems) {
            count++; // system
            count += s.assets.length;
          }
        }
      }
    }
    count += config.engineeringIssues?.length ?? 0;
    count += config.workpacks?.length ?? 0;
    count += config.workpacks?.reduce((s, wp) => s + (wp.activities?.length ?? 0), 0) ?? 0;
    count += config.shutdownEvent ? 1 : 0;
    count += config.license ? 1 : 0;
    return count;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const seedPackService = new SeedPackService();
