/**
 * M7.7.1 — Provisioning Template Service
 *
 * Manages industry-specific provisioning templates.
 * Built-in templates provide realistic default hierarchies for
 * Refinery, Petrochemical, Fertilizer, Gas Processing, LNG, Pipeline,
 * Tank Farm, Power Plant, and Chemical Plant industries.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { ProvisioningRequest } from '@/core/Platform/TenantProvisioningService';

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in Template Definitions
// ═══════════════════════════════════════════════════════════════════════════════

interface TemplateConfig {
  hierarchy: ProvisioningRequest['hierarchy'];
  disciplines: string[];
  equipmentTypes: string[];
  modules: string[];
  calendars: string[];
}

const plant = (name: string, code: string, units: Array<{ name: string; code: string; systems: Array<{ name: string; code: string }> }>) => ({
  name, code, areas: [], units,
});
const unit = (name: string, code: string, systems: string[][]) => ({
  name, code,
  systems: systems.map(([n, c]) => ({ name: n, code: c })),
});

const BUILTIN_TEMPLATES: Array<{
  slug: string; name: string; industry: string; description: string; config: TemplateConfig;
}> = [
  {
    slug: 'blank',
    name: 'Blank Template',
    industry: 'general',
    description: 'Empty template — no default hierarchy, disciplines, or equipment. Start from scratch.',
    config: {
      hierarchy: { plants: [], disciplines: [] },
      disciplines: [],
      equipmentTypes: [],
      modules: ['shutdown_scope', 'planner_workspace'],
      calendars: ['5-Day Work Week'],
    },
  },
  {
    slug: 'refinery',
    name: 'Oil & Gas Refinery',
    industry: 'refinery',
    description: 'Complete refinery hierarchy: CDU, VDU, FCC, Hydrotreater, SRU, Utilities.',
    config: {
      hierarchy: {
        plants: [
          plant('Crude Distillation Unit', 'CDU', [
            unit('Atmospheric Column', 'CDU-AT', [['Crude Preheater', 'CDU-PHT'], ['Desalter', 'CDU-DST'], ['Atmospheric Tower', 'CDU-ATW']]),
            unit('Vacuum Column', 'CDU-VU', [['Vacuum Tower', 'CDU-VT'], ['Vacuum Ejector', 'CDU-VE']]),
          ]),
          plant('Fluid Catalytic Cracker', 'FCC', [
            unit('Reactor', 'FCC-RX', [['Riser Reactor', 'FCC-RR'], ['Regenerator', 'FCC-RG']]),
            unit('Main Fractionator', 'FCC-MF', [['Fractionator Column', 'FCC-FC']]),
          ]),
          plant('Hydrotreater', 'HDT', [
            unit('Naphtha Hydrotreater', 'NHT', [['NHT Reactor', 'NHT-RX'], ['NHT Stripper', 'NHT-ST']]),
            unit('Diesel Hydrotreater', 'DHT', [['DHT Reactor', 'DHT-RX'], ['DHT Separator', 'DHT-SP']]),
          ]),
          plant('Sulphur Recovery Unit', 'SRU', [
            unit('Claus Unit', 'SRU-CL', [['Claus Reactor', 'SRU-RX'], ['Condenser', 'SRU-CD']]),
          ]),
          plant('Utilities', 'UTL', [
            unit('Steam Generation', 'UTL-STM', [['Boiler', 'UTL-BLR'], ['Deaerator', 'UTL-DAR']]),
            unit('Cooling Water', 'UTL-CW', [['Cooling Tower', 'UTL-CT'], ['CW Pumps', 'UTL-CWP']]),
            unit('Instrument Air', 'UTL-IA', [['Air Compressor', 'UTL-AC'], ['Air Dryer', 'UTL-AD']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL', 'ROTG', 'SCAF', 'INSU', 'PNTG'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL', 'ROTG', 'SCAF', 'INSU', 'PNTG'],
      equipmentTypes: ['PMP', 'CMP', 'HEX', 'PHE', 'VES', 'COL', 'REA', 'VLV', 'PSV', 'TNK', 'MTR', 'BLR', 'FAN', 'FLT', 'DRM', 'FLR'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'engineering_issues', 'bre', 'report_builder', 'safety', 'asset_register'],
      calendars: ['5-Day Work Week', '12-Hour Shutdown', 'Turnaround Calendar'],
    },
  },
  {
    slug: 'petrochemical',
    name: 'Petrochemical Complex',
    industry: 'petrochemical',
    description: 'Ethylene cracker, polymerization, and downstream processing.',
    config: {
      hierarchy: {
        plants: [
          plant('Ethylene Cracker', 'EC', [
            unit('Cracking Furnaces', 'EC-CF', [['Furnace A', 'EC-FA'], ['Furnace B', 'EC-FB']]),
            unit('Quench', 'EC-QU', [['Quench Tower', 'EC-QT'], ['Oil Quench', 'EC-OQ']]),
            unit('Cold Box', 'EC-CB', [['Demethanizer', 'EC-DM'], ['Ethylene Splitter', 'EC-ES']]),
          ]),
          plant('Polyethylene', 'PE', [
            unit('Reactor', 'PE-RX', [['Loop Reactor', 'PE-LR'], ['Flash Tank', 'PE-FT']]),
            unit('Extrusion', 'PE-EX', [['Extruder', 'PE-XTR'], ['Pelletizer', 'PE-PLT']]),
          ]),
          plant('Polypropylene', 'PP', [
            unit('Reactor', 'PP-RX', [['PP Reactor', 'PP-R1']]),
            unit('Finishing', 'PP-FN', [['Dryer', 'PP-DR'], ['Silo', 'PP-SL']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'ROTG'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'ROTG'],
      equipmentTypes: ['PMP', 'CMP', 'HEX', 'VES', 'COL', 'REA', 'VLV', 'PSV', 'FAN', 'CNV'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'engineering_issues', 'safety'],
      calendars: ['5-Day Work Week', '12-Hour Shutdown'],
    },
  },
  {
    slug: 'fertilizer',
    name: 'Fertilizer Plant',
    industry: 'fertilizer',
    description: 'Ammonia, Urea, NPK production and utilities.',
    config: {
      hierarchy: {
        plants: [
          plant('Ammonia Plant', 'NH3', [
            unit('Reformer', 'NH3-RF', [['Primary Reformer', 'NH3-PR'], ['Secondary Reformer', 'NH3-SR']]),
            unit('Synthesis', 'NH3-SY', [['Synthesis Converter', 'NH3-SC'], ['Ammonia Separator', 'NH3-AS']]),
          ]),
          plant('Urea Plant', 'UREA', [
            unit('Synthesis', 'UR-SY', [['Urea Reactor', 'UR-RX'], ['Stripper', 'UR-ST']]),
            unit('Granulation', 'UR-GR', [['Granulator', 'UR-GRN'], ['Cooler', 'UR-CL']]),
          ]),
          plant('NPK Plant', 'NPK', [
            unit('Mixing', 'NPK-MX', [['Mixer', 'NPK-M1']]),
            unit('Bagging', 'NPK-BG', [['Bagging Machine', 'NPK-B1']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL'],
      equipmentTypes: ['PMP', 'CMP', 'HEX', 'VES', 'COL', 'REA', 'VLV', 'TNK', 'FAN', 'CNV'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'safety'],
      calendars: ['6-Day Work Week', '12-Hour Shutdown'],
    },
  },
  {
    slug: 'gas-processing',
    name: 'Gas Processing Plant',
    industry: 'gas_processing',
    description: 'Gas sweetening, dehydration, NGL recovery.',
    config: {
      hierarchy: {
        plants: [
          plant('Gas Sweetening', 'GSW', [
            unit('Amine Contactor', 'GSW-AC', [['Absorber', 'GSW-AB'], ['Regenerator', 'GSW-RG']]),
          ]),
          plant('Dehydration', 'DHY', [
            unit('TEG Contactor', 'DHY-TC', [['TEG Absorber', 'DHY-TA'], ['TEG Regen', 'DHY-TR']]),
          ]),
          plant('NGL Recovery', 'NGL', [
            unit('Turboexpander', 'NGL-TE', [['Expander', 'NGL-EX'], ['Demethanizer', 'NGL-DM']]),
            unit('Fractionation', 'NGL-FR', [['Depropanizer', 'NGL-DP'], ['Debutanizer', 'NGL-DB']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'ROTG'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'ROTG'],
      equipmentTypes: ['PMP', 'CMP', 'HEX', 'VES', 'COL', 'VLV', 'PSV', 'FLT', 'DRM'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'engineering_issues'],
      calendars: ['7-Day Continuous', '12-Hour Shutdown'],
    },
  },
  {
    slug: 'lng-terminal',
    name: 'LNG Terminal',
    industry: 'lng',
    description: 'Liquefaction train, storage, jetty, and utilities.',
    config: {
      hierarchy: {
        plants: [
          plant('Liquefaction Train', 'LT', [
            unit('Pre-treatment', 'LT-PT', [['Acid Gas Removal', 'LT-AGR'], ['Dehydration', 'LT-DH']]),
            unit('Liquefaction', 'LT-LQ', [['Main Cryogenic HX', 'LT-MCHE'], ['Refrigerant Compressor', 'LT-RC']]),
          ]),
          plant('LNG Storage', 'STR', [
            unit('Storage Tanks', 'STR-TK', [['Tank 1', 'STR-T1'], ['Tank 2', 'STR-T2']]),
          ]),
          plant('Marine / Jetty', 'JTY', [
            unit('Loading Arms', 'JTY-LA', [['Loading Arm 1', 'JTY-L1'], ['Loading Arm 2', 'JTY-L2']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL', 'ROTG'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL', 'ROTG'],
      equipmentTypes: ['PMP', 'CMP', 'HEX', 'VES', 'TNK', 'VLV', 'PSV', 'CRN'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'engineering_issues', 'safety', 'asset_register'],
      calendars: ['7-Day Continuous', '12-Hour Shutdown', 'Turnaround Calendar'],
    },
  },
  {
    slug: 'pipeline',
    name: 'Pipeline Operations',
    industry: 'pipeline',
    description: 'Compressor stations, metering, and SCADA.',
    config: {
      hierarchy: {
        plants: [
          plant('Compressor Station 1', 'CS1', [
            unit('Compression', 'CS1-CP', [['Gas Compressor', 'CS1-GC'], ['Cooler', 'CS1-CL']]),
            unit('Metering', 'CS1-MT', [['Ultrasonic Meter', 'CS1-UM']]),
          ]),
          plant('Compressor Station 2', 'CS2', [
            unit('Compression', 'CS2-CP', [['Gas Compressor', 'CS2-GC']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE'],
      equipmentTypes: ['PMP', 'CMP', 'VLV', 'PSV', 'FLT'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant'],
      calendars: ['7-Day Continuous'],
    },
  },
  {
    slug: 'tank-farm',
    name: 'Tank Farm',
    industry: 'tank_farm',
    description: 'Crude, product, chemical storage with loading/unloading.',
    config: {
      hierarchy: {
        plants: [
          plant('Crude Tank Farm', 'CTF', [
            unit('Crude Tanks', 'CTF-TK', [['Tank T-101', 'CTF-T101'], ['Tank T-102', 'CTF-T102'], ['Tank T-103', 'CTF-T103']]),
          ]),
          plant('Product Tank Farm', 'PTF', [
            unit('Product Tanks', 'PTF-TK', [['Tank T-201', 'PTF-T201'], ['Tank T-202', 'PTF-T202']]),
          ]),
          plant('Loading Facility', 'LDF', [
            unit('Truck Loading', 'LDF-TL', [['Loading Bay 1', 'LDF-LB1'], ['Loading Bay 2', 'LDF-LB2']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL'],
      equipmentTypes: ['PMP', 'TNK', 'VLV', 'PSV', 'FLT', 'MTR'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'safety'],
      calendars: ['5-Day Work Week', '12-Hour Shutdown'],
    },
  },
  {
    slug: 'power-plant',
    name: 'Power Plant',
    industry: 'power_plant',
    description: 'Boiler, turbine, generator, and balance of plant.',
    config: {
      hierarchy: {
        plants: [
          plant('Boiler Island', 'BLR', [
            unit('Boiler', 'BLR-01', [['Steam Drum', 'BLR-SD'], ['Superheater', 'BLR-SH'], ['Economizer', 'BLR-EC']]),
            unit('Coal Handling', 'BLR-CH', [['Crusher', 'BLR-CR'], ['Conveyor', 'BLR-CV']]),
          ]),
          plant('Turbine Generator', 'TG', [
            unit('Steam Turbine', 'TG-ST', [['HP Turbine', 'TG-HP'], ['LP Turbine', 'TG-LP']]),
            unit('Generator', 'TG-GEN', [['Generator', 'TG-G1'], ['Exciter', 'TG-EX']]),
          ]),
          plant('Balance of Plant', 'BOP', [
            unit('Cooling System', 'BOP-CW', [['Cooling Tower', 'BOP-CT'], ['CW Pumps', 'BOP-CWP']]),
            unit('Water Treatment', 'BOP-WT', [['DM Plant', 'BOP-DM'], ['RO Plant', 'BOP-RO']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'CIVL', 'ROTG'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'CIVL', 'ROTG'],
      equipmentTypes: ['PMP', 'BLR', 'GEN', 'TRF', 'FAN', 'CMP', 'HEX', 'VLV', 'CNV'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'safety', 'asset_register'],
      calendars: ['7-Day Continuous', 'Maintenance Calendar'],
    },
  },
  {
    slug: 'chemical-plant',
    name: 'Chemical Plant',
    industry: 'chemical_plant',
    description: 'Reactor, separation, purification, and product storage.',
    config: {
      hierarchy: {
        plants: [
          plant('Reaction Section', 'RXN', [
            unit('Reactor', 'RXN-R1', [['CSTR Reactor', 'RXN-CSTR'], ['Agitator', 'RXN-AGT']]),
          ]),
          plant('Separation', 'SEP', [
            unit('Distillation', 'SEP-DT', [['Column C-101', 'SEP-C101'], ['Reboiler', 'SEP-RB']]),
            unit('Extraction', 'SEP-EX', [['Extractor', 'SEP-EXT']]),
          ]),
          plant('Purification & Storage', 'PUR', [
            unit('Purification', 'PUR-PF', [['Crystallizer', 'PUR-CR'], ['Dryer', 'PUR-DR']]),
            unit('Product Storage', 'PUR-ST', [['Tank T-301', 'PUR-T301']]),
          ]),
        ],
        disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL'],
      },
      disciplines: ['MECH', 'ELEC', 'INST', 'PIPE', 'CIVL'],
      equipmentTypes: ['PMP', 'HEX', 'VES', 'COL', 'REA', 'VLV', 'PSV', 'TNK', 'FLT', 'DRM'],
      modules: ['shutdown_scope', 'planner_workspace', 'digital_plant', 'engineering_issues', 'safety'],
      calendars: ['6-Day Work Week', '12-Hour Shutdown'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class ProvisioningTemplateService {

  /**
   * Seed all built-in templates (idempotent).
   */
  async seedBuiltinTemplates(): Promise<number> {
    let count = 0;
    for (const tpl of BUILTIN_TEMPLATES) {
      await prisma.provisioning_templates.upsert({
        where: { slug: tpl.slug },
        update: {
          name: tpl.name,
          industry: tpl.industry,
          description: tpl.description,
          config: tpl.config as any,
          is_builtin: true,
        },
        create: {
          slug: tpl.slug,
          name: tpl.name,
          industry: tpl.industry,
          description: tpl.description,
          config: tpl.config as any,
          is_builtin: true,
        },
      });
      count++;
    }
    logger.info('ProvisioningTemplateService', `Seeded ${count} built-in templates`);
    return count;
  }

  /**
   * List all templates.
   */
  async list() {
    return prisma.provisioning_templates.findMany({
      orderBy: [{ is_builtin: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a template by ID or slug.
   */
  async get(idOrSlug: string) {
    return prisma.provisioning_templates.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
  }

  /**
   * Create a custom template.
   */
  async create(data: { slug: string; name: string; industry?: string; description?: string; config: any; createdBy?: string }) {
    return prisma.provisioning_templates.create({
      data: {
        slug: data.slug,
        name: data.name,
        industry: data.industry,
        description: data.description,
        config: data.config,
        is_builtin: false,
        created_by: data.createdBy,
      },
    });
  }

  /**
   * Update a template.
   */
  async update(id: string, data: Partial<{ name: string; description: string; config: any; industry: string }>) {
    return prisma.provisioning_templates.update({
      where: { id },
      data: data as any,
    });
  }

  /**
   * Delete a template (cannot delete built-in).
   */
  async delete(id: string) {
    const tpl = await prisma.provisioning_templates.findUnique({ where: { id } });
    if (!tpl) throw new Error('Template not found');
    if (tpl.is_builtin) throw new Error('Cannot delete built-in template');
    return prisma.provisioning_templates.delete({ where: { id } });
  }

  /**
   * Merge template config into a provisioning request.
   * Template provides defaults; user overrides take precedence.
   */
  applyToRequest(templateConfig: any, request: ProvisioningRequest): ProvisioningRequest {
    const merged = { ...request };

    // If user didn't specify hierarchy plants, use template's
    if (!merged.hierarchy.plants || merged.hierarchy.plants.length === 0) {
      merged.hierarchy.plants = templateConfig.hierarchy?.plants ?? [];
    }

    // If user didn't specify disciplines, use template's
    if (!merged.hierarchy.disciplines || merged.hierarchy.disciplines.length === 0) {
      merged.hierarchy.disciplines = templateConfig.disciplines ?? [];
    }

    // If user didn't specify modules, use template's
    if (!merged.license.enabledModules || merged.license.enabledModules.length === 0) {
      merged.license.enabledModules = templateConfig.modules ?? [];
    }

    return merged;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const provisioningTemplateService = new ProvisioningTemplateService();
