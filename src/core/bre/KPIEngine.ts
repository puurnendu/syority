/**
 * M7.6E — KPI Engine
 *
 * Derived KPI management. Each KPI wraps a formula and auto-registers
 * as a provider in ProviderRegistry.
 *
 * Architecture:
 *   KPI Definition → Formula → FormulaEngine → ProviderRegistry → OIS/Reports
 *
 * Every active KPI is available as:
 *   • Dashboard Widget (via ProviderRegistry)
 *   • Report data source
 *   • API endpoint
 *   • Notification Rule condition
 *   • Meeting Mode / TV Mode
 */

import { prisma } from '@/lib/prisma';
import { providerRegistry } from '@/core/report-engine/providers';
import { BaseProvider, type ProviderContext } from '@/core/report-engine/providers/BaseProvider';
import type { DataFetcherResult } from '@/core/report-engine/data-fetchers';
import { evaluateExpression, type EvaluationContext } from './FormulaEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KPIDefinition {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  formulaId: string;
  thresholdGreen: number | null;
  thresholdAmber: number | null;
  thresholdRed: number | null;
  invertThresholds: boolean;
  targetValue: number | null;
  displayFormat: string;
  trendDirection: string | null;
  providerKey: string;
  status: string;
  isSystem: boolean;
}

export interface CreateKPIInput {
  organizationId: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  formulaId: string;
  thresholdGreen?: number;
  thresholdAmber?: number;
  thresholdRed?: number;
  invertThresholds?: boolean;
  targetValue?: number;
  displayFormat?: string;
  trendDirection?: string;
  createdBy: string;
}

// ─── Dynamic KPI Provider ───────────────────────────────────────────────────

/**
 * A provider that evaluates a formula expression to produce KPI data.
 * Created dynamically for each active KPI definition.
 */
class DynamicKPIProvider extends BaseProvider {
  readonly key: string;
  readonly category: string;
  readonly name: string;
  readonly description: string;
  readonly requiredParams = ['event'];

  private expression: string;
  private variables: any[];
  private thresholdGreen: number | null;
  private thresholdAmber: number | null;
  private thresholdRed: number | null;
  private invertThresholds: boolean;
  private targetValue: number | null;
  private displayFormat: string;
  private trendDirection: string | null;
  private unit: string | null;

  constructor(kpi: any, formula: any) {
    super();
    this.key = kpi.provider_key;
    this.category = kpi.category;
    this.name = kpi.name;
    this.description = kpi.description ?? `Derived KPI: ${kpi.name}`;
    this.expression = formula.expression;
    this.variables = (formula.variables as any[]) ?? [];
    this.thresholdGreen = kpi.threshold_green;
    this.thresholdAmber = kpi.threshold_amber;
    this.thresholdRed = kpi.threshold_red;
    this.invertThresholds = kpi.invert_thresholds;
    this.targetValue = kpi.target_value;
    this.displayFormat = kpi.display_format;
    this.trendDirection = kpi.trend_direction;
    this.unit = formula.unit;
  }

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    // Build variable context from formula variable definitions
    const variableValues: Record<string, any> = {};
    for (const v of this.variables) {
      if (v.default !== undefined) variableValues[v.name] = v.default;
      if (params[v.name] !== undefined) variableValues[v.name] = params[v.name];
    }

    const evalCtx: EvaluationContext = {
      providerCtx: ctx,
      variables: variableValues,
      providerParams: params,
      providerCache: new Map(),
    };

    try {
      const value = await evaluateExpression(this.expression, evalCtx);
      const numValue = Number(value) || 0;

      // Determine threshold color
      let color = '#6B7280'; // default gray
      if (this.thresholdGreen != null && this.thresholdAmber != null && this.thresholdRed != null) {
        if (this.invertThresholds) {
          // Lower is better (e.g., TRIR)
          if (numValue <= this.thresholdGreen) color = '#10B981';
          else if (numValue <= this.thresholdAmber) color = '#F59E0B';
          else color = '#DC2626';
        } else {
          // Higher is better (e.g., SPI)
          if (numValue >= this.thresholdGreen) color = '#10B981';
          else if (numValue >= this.thresholdAmber) color = '#F59E0B';
          else color = '#DC2626';
        }
      }

      // Determine trend arrow
      let trendIcon = '';
      if (this.trendDirection === 'up_good') trendIcon = numValue >= (this.targetValue ?? 0) ? '↑' : '↓';
      else if (this.trendDirection === 'down_good') trendIcon = numValue <= (this.targetValue ?? 0) ? '↓' : '↑';

      // Format display value
      let displayValue: string | number = numValue;
      if (this.displayFormat === 'percentage') displayValue = `${numValue.toFixed(1)}%`;
      else if (this.displayFormat === 'ratio') displayValue = numValue.toFixed(2);
      else if (this.displayFormat === 'currency') displayValue = `$${numValue.toLocaleString()}`;
      else displayValue = numValue.toFixed(2);

      return {
        kpis: [{
          label: this.name,
          value: displayValue,
          unit: this.unit ?? undefined,
          color,
          target: this.targetValue ?? undefined,
          trend: trendIcon || undefined,
        }],
        rows: [{ kpi: this.name, value: numValue, target: this.targetValue, color }],
      };
    } catch (err: any) {
      return {
        kpis: [{ label: this.name, value: 'Error', color: '#DC2626' }],
        rows: [{ kpi: this.name, error: err.message }],
      };
    }
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export class KPIEngine {

  /**
   * Create a new KPI definition and register it as a provider.
   */
  static async create(input: CreateKPIInput): Promise<KPIDefinition> {
    const providerKey = `kpi.${input.slug}`;

    const kpi = await prisma.bre_kpi_definitions.create({
      data: {
        organization_id: input.organizationId,
        slug: input.slug,
        name: input.name,
        description: input.description,
        category: input.category,
        icon: input.icon,
        formula_id: input.formulaId,
        threshold_green: input.thresholdGreen,
        threshold_amber: input.thresholdAmber,
        threshold_red: input.thresholdRed,
        invert_thresholds: input.invertThresholds ?? false,
        target_value: input.targetValue,
        display_format: input.displayFormat ?? 'number',
        trend_direction: input.trendDirection,
        provider_key: providerKey,
        status: 'draft',
        created_by: input.createdBy,
      },
    });

    return mapKPI(kpi);
  }

  /**
   * Activate a KPI and register it in ProviderRegistry.
   */
  static async activate(id: string, activatedBy: string): Promise<KPIDefinition> {
    const kpi = await prisma.bre_kpi_definitions.findUniqueOrThrow({
      where: { id },
    });

    const formula = await prisma.bre_formulas.findUniqueOrThrow({
      where: { id: kpi.formula_id },
    });

    if (formula.status !== 'active') {
      throw new Error(`Formula '${formula.slug}' must be active before KPI can be activated`);
    }

    // Register as provider
    const provider = new DynamicKPIProvider(kpi, formula);
    providerRegistry.register(provider);

    const updated = await prisma.bre_kpi_definitions.update({
      where: { id },
      data: { status: 'active', updated_by: activatedBy },
    });

    return mapKPI(updated);
  }

  /**
   * Load and register all active KPIs for an organization.
   * Call at startup or when KPIs change.
   */
  static async loadActiveKPIs(organizationId: string): Promise<number> {
    const kpis = await prisma.bre_kpi_definitions.findMany({
      where: { organization_id: organizationId, status: 'active' },
    });

    let registered = 0;
    for (const kpi of kpis) {
      try {
        const formula = await prisma.bre_formulas.findUnique({ where: { id: kpi.formula_id } });
        if (!formula || formula.status !== 'active') continue;

        const provider = new DynamicKPIProvider(kpi, formula);
        providerRegistry.register(provider);
        registered++;
      } catch { /* skip failed KPIs */ }
    }

    return registered;
  }

  /**
   * Evaluate a KPI and return its current value.
   */
  static async evaluate(id: string, ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const kpi = await prisma.bre_kpi_definitions.findUniqueOrThrow({ where: { id } });

    if (!providerRegistry.has(kpi.provider_key)) {
      // Auto-register if not loaded yet
      const formula = await prisma.bre_formulas.findUniqueOrThrow({ where: { id: kpi.formula_id } });
      const provider = new DynamicKPIProvider(kpi, formula);
      providerRegistry.register(provider);
    }

    return providerRegistry.fetch(kpi.provider_key, ctx, params);
  }

  /**
   * List all KPIs for an organization.
   */
  static async list(organizationId: string, filters?: {
    category?: string;
    status?: string;
  }): Promise<KPIDefinition[]> {
    const where: any = { organization_id: organizationId };
    if (filters?.category) where.category = filters.category;
    if (filters?.status) where.status = filters.status;

    const kpis = await prisma.bre_kpi_definitions.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return kpis.map(mapKPI);
  }

  /**
   * Get a KPI by ID.
   */
  static async getById(id: string): Promise<KPIDefinition | null> {
    const kpi = await prisma.bre_kpi_definitions.findUnique({ where: { id } });
    return kpi ? mapKPI(kpi) : null;
  }

  /**
   * Get built-in KPI definitions (for seeding).
   */
  static getBuiltInKPIs(): Array<Omit<CreateKPIInput, 'organizationId' | 'createdBy' | 'formulaId'> & { formulaSlug: string }> {
    return [
      { slug: 'spi', name: 'Schedule Performance Index', category: 'planning', icon: '📊', formulaSlug: 'spi_calculation', thresholdGreen: 1.0, thresholdAmber: 0.9, thresholdRed: 0.8, targetValue: 1.0, displayFormat: 'ratio', trendDirection: 'up_good' },
      { slug: 'cpi', name: 'Cost Performance Index', category: 'planning', icon: '💰', formulaSlug: 'cpi_calculation', thresholdGreen: 1.0, thresholdAmber: 0.9, thresholdRed: 0.8, targetValue: 1.0, displayFormat: 'ratio', trendDirection: 'up_good' },
      { slug: 'schedule_health', name: 'Schedule Health Index', category: 'planning', icon: '🩺', formulaSlug: 'schedule_health_calculation', thresholdGreen: 80, thresholdAmber: 60, thresholdRed: 40, targetValue: 85, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'mech_productivity', name: 'Mechanical Productivity', category: 'execution', icon: '🔧', formulaSlug: 'mech_productivity_calculation', thresholdGreen: 80, thresholdAmber: 60, thresholdRed: 40, targetValue: 85, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'safety_index', name: 'Safety Index', category: 'safety', icon: '🛡️', formulaSlug: 'safety_index_calculation', thresholdGreen: 90, thresholdAmber: 75, thresholdRed: 60, targetValue: 95, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'trir', name: 'TRIR', category: 'safety', icon: '⚠️', formulaSlug: 'trir_calculation', thresholdGreen: 0.5, thresholdAmber: 1.0, thresholdRed: 2.0, invertThresholds: true, targetValue: 0, displayFormat: 'ratio', trendDirection: 'down_good' },
      { slug: 'contractor_performance', name: 'Contractor Performance', category: 'management', icon: '👷', formulaSlug: 'contractor_performance_calculation', thresholdGreen: 85, thresholdAmber: 70, thresholdRed: 50, targetValue: 90, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'inspection_completion', name: 'Inspection Completion', category: 'execution', icon: '🔍', formulaSlug: 'inspection_completion_calculation', thresholdGreen: 95, thresholdAmber: 80, thresholdRed: 60, targetValue: 100, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'equipment_readiness', name: 'Equipment Readiness', category: 'execution', icon: '⚙️', formulaSlug: 'equipment_readiness_calculation', thresholdGreen: 90, thresholdAmber: 75, thresholdRed: 50, targetValue: 95, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'permit_compliance', name: 'Permit Compliance', category: 'safety', icon: '📋', formulaSlug: 'permit_compliance_calculation', thresholdGreen: 95, thresholdAmber: 85, thresholdRed: 70, targetValue: 100, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'punch_density', name: 'Punch Density', category: 'execution', icon: '📌', formulaSlug: 'punch_density_calculation', thresholdGreen: 0.1, thresholdAmber: 0.3, thresholdRed: 0.5, invertThresholds: true, targetValue: 0, displayFormat: 'ratio', trendDirection: 'down_good' },
      { slug: 'quality_score', name: 'Quality Score', category: 'execution', icon: '⭐', formulaSlug: 'quality_score_calculation', thresholdGreen: 90, thresholdAmber: 75, thresholdRed: 60, targetValue: 95, displayFormat: 'percentage', trendDirection: 'up_good' },
      { slug: 'execution_efficiency', name: 'Execution Efficiency', category: 'execution', icon: '⚡', formulaSlug: 'execution_efficiency_calculation', thresholdGreen: 85, thresholdAmber: 70, thresholdRed: 50, targetValue: 90, displayFormat: 'percentage', trendDirection: 'up_good' },
    ];
  }
}

// ─── Mapper ─────────────────────────────────────────────────────────────────

function mapKPI(row: any): KPIDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    icon: row.icon,
    formulaId: row.formula_id,
    thresholdGreen: row.threshold_green,
    thresholdAmber: row.threshold_amber,
    thresholdRed: row.threshold_red,
    invertThresholds: row.invert_thresholds,
    targetValue: row.target_value,
    displayFormat: row.display_format,
    trendDirection: row.trend_direction,
    providerKey: row.provider_key,
    status: row.status,
    isSystem: row.is_system,
  };
}
