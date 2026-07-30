/**
 * M7.6E — Formula Service
 *
 * CRUD, versioning, testing, and dependency resolution for formulas.
 * All data stored in bre_formulas / bre_formula_versions.
 */

import { prisma } from '@/lib/prisma';
import {
  tokenize,
  FormulaParser,
  evaluate,
  validateExpression,
  extractProviderDependencies,
  extractVariables,
  detectCircularDependency,
  type EvaluationContext,
  type FormulaDependency,
} from './FormulaEngine';
import type { ProviderContext } from '@/core/report-engine/providers/BaseProvider';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FormulaDefinition {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  expression: string;
  variables: any[];
  returnType: string;
  unit: string | null;
  precision: number;
  isValidated: boolean;
  validationErrors: any[] | null;
  dependencyGraph: FormulaDependency[] | null;
  version: number;
  status: string;
  isSystem: boolean;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFormulaInput {
  organizationId: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  expression: string;
  variables?: any[];
  returnType?: string;
  unit?: string;
  precision?: number;
  ownerId?: string;
  createdBy: string;
}

export interface UpdateFormulaInput {
  name?: string;
  description?: string;
  category?: string;
  expression?: string;
  variables?: any[];
  returnType?: string;
  unit?: string;
  precision?: number;
  status?: string;
  updatedBy: string;
  changeDescription?: string;
}

export interface FormulaTestResult {
  success: boolean;
  result: any;
  durationMs: number;
  error?: string;
  providerDependencies: string[];
  variablesDefined: string[];
}

// ─── Service ────────────────────────────────────────────────────────────────

export class FormulaService {

  /**
   * Create a new formula definition.
   */
  static async create(input: CreateFormulaInput): Promise<FormulaDefinition> {
    // Validate expression
    const errors = validateExpression(input.expression);
    const isValidated = errors.length === 0;

    // Build dependency graph
    let depGraph: FormulaDependency[] = [];
    try {
      const tokens = tokenize(input.expression);
      const ast = new FormulaParser(tokens).parse();
      const providerDeps = extractProviderDependencies(ast);
      depGraph = providerDeps.map((dep) => ({ from: input.slug, to: dep }));
    } catch { /* validation errors already captured */ }

    const formula = await prisma.bre_formulas.create({
      data: {
        organization_id: input.organizationId,
        slug: input.slug,
        name: input.name,
        description: input.description,
        category: input.category,
        expression: input.expression,
        variables: input.variables ?? [],
        return_type: input.returnType ?? 'number',
        unit: input.unit,
        precision: input.precision ?? 2,
        is_validated: isValidated,
        validation_errors: errors.length > 0 ? errors : undefined,
        dependency_graph: depGraph.length > 0 ? depGraph : undefined,
        version: 1,
        status: 'draft',
        owner_id: input.ownerId,
        created_by: input.createdBy,
      },
    });

    // Create initial version
    await prisma.bre_formula_versions.create({
      data: {
        formula_id: formula.id,
        version_number: 1,
        expression: input.expression,
        variables: input.variables ?? [],
        change_description: 'Initial version',
        created_by: input.createdBy,
      },
    });

    return mapFormula(formula);
  }

  /**
   * Update a formula. Creates a new version automatically.
   */
  static async update(id: string, input: UpdateFormulaInput): Promise<FormulaDefinition> {
    const existing = await prisma.bre_formulas.findUniqueOrThrow({ where: { id } });

    // If expression changed, re-validate
    let isValidated = existing.is_validated;
    let validationErrors = existing.validation_errors;
    let depGraph = existing.dependency_graph;
    let newVersion = existing.version;

    if (input.expression && input.expression !== existing.expression) {
      const errors = validateExpression(input.expression);
      isValidated = errors.length === 0;
      validationErrors = errors.length > 0 ? errors : null;

      try {
        const tokens = tokenize(input.expression);
        const ast = new FormulaParser(tokens).parse();
        const providerDeps = extractProviderDependencies(ast);
        depGraph = providerDeps.map((dep) => ({ from: existing.slug, to: dep }));
      } catch { /* captured in validation */ }

      // Increment version
      newVersion = existing.version + 1;

      // Create version snapshot
      await prisma.bre_formula_versions.create({
        data: {
          formula_id: id,
          version_number: newVersion,
          expression: input.expression,
          variables: input.variables ?? (existing.variables as any[]),
          change_description: input.changeDescription ?? `Updated to v${newVersion}`,
          created_by: input.updatedBy,
        },
      });
    }

    const updated = await prisma.bre_formulas.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        expression: input.expression,
        variables: input.variables,
        return_type: input.returnType,
        unit: input.unit,
        precision: input.precision,
        status: input.status,
        is_validated: isValidated,
        validation_errors: validationErrors,
        dependency_graph: depGraph,
        version: newVersion,
        updated_by: input.updatedBy,
      },
    });

    return mapFormula(updated);
  }

  /**
   * Get a formula by ID.
   */
  static async getById(id: string): Promise<FormulaDefinition | null> {
    const formula = await prisma.bre_formulas.findUnique({ where: { id } });
    return formula ? mapFormula(formula) : null;
  }

  /**
   * Get a formula by slug within an organization.
   */
  static async getBySlug(organizationId: string, slug: string): Promise<FormulaDefinition | null> {
    const formula = await prisma.bre_formulas.findUnique({
      where: { organization_id_slug: { organization_id: organizationId, slug } },
    });
    return formula ? mapFormula(formula) : null;
  }

  /**
   * List formulas for an organization.
   */
  static async list(organizationId: string, filters?: {
    category?: string;
    status?: string;
    search?: string;
  }): Promise<FormulaDefinition[]> {
    const where: any = { organization_id: organizationId };
    if (filters?.category) where.category = filters.category;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const formulas = await prisma.bre_formulas.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return formulas.map(mapFormula);
  }

  /**
   * Get version history for a formula.
   */
  static async getVersionHistory(formulaId: string): Promise<any[]> {
    return prisma.bre_formula_versions.findMany({
      where: { formula_id: formulaId },
      orderBy: { version_number: 'desc' },
    });
  }

  /**
   * Test a formula expression with sample data.
   */
  static async test(
    expression: string,
    variables: Record<string, any>,
    providerCtx: ProviderContext,
    providerParams?: Record<string, any>,
  ): Promise<FormulaTestResult> {
    const start = Date.now();
    let providerDependencies: string[] = [];
    let variablesDefined: string[] = [];

    try {
      const tokens = tokenize(expression);
      const parser = new FormulaParser(tokens);
      const ast = parser.parse();

      providerDependencies = extractProviderDependencies(ast);
      variablesDefined = extractVariables(ast);

      const ctx: EvaluationContext = {
        providerCtx,
        variables,
        providerParams: providerParams ?? {},
        providerCache: new Map(),
      };

      const result = await evaluate(ast, ctx);
      return {
        success: true,
        result,
        durationMs: Date.now() - start,
        providerDependencies,
        variablesDefined,
      };
    } catch (err: any) {
      return {
        success: false,
        result: null,
        durationMs: Date.now() - start,
        error: err.message,
        providerDependencies,
        variablesDefined,
      };
    }
  }

  /**
   * Validate that no circular dependencies exist among org formulas.
   */
  static async validateDependencies(organizationId: string): Promise<{
    valid: boolean;
    cycle: string[] | null;
  }> {
    const formulas = await prisma.bre_formulas.findMany({
      where: { organization_id: organizationId },
      select: { slug: true, dependency_graph: true },
    });

    const allEdges: FormulaDependency[] = [];
    for (const f of formulas) {
      const deps = (f.dependency_graph as FormulaDependency[]) ?? [];
      allEdges.push(...deps);
    }

    const cycle = detectCircularDependency(allEdges);
    return { valid: cycle === null, cycle };
  }

  /**
   * Delete a formula (soft — set to archived).
   */
  static async delete(id: string, deletedBy: string): Promise<void> {
    const formula = await prisma.bre_formulas.findUniqueOrThrow({ where: { id } });
    if (formula.is_system) throw new Error('Cannot delete system formula');

    await prisma.bre_formulas.update({
      where: { id },
      data: { status: 'archived', updated_by: deletedBy },
    });
  }

  /**
   * Activate a formula (draft → active).
   */
  static async activate(id: string, activatedBy: string): Promise<FormulaDefinition> {
    const formula = await prisma.bre_formulas.findUniqueOrThrow({ where: { id } });
    if (!formula.is_validated) throw new Error('Cannot activate formula with validation errors');

    const updated = await prisma.bre_formulas.update({
      where: { id },
      data: { status: 'active', updated_by: activatedBy },
    });

    return mapFormula(updated);
  }
}

// ─── Mapper ─────────────────────────────────────────────────────────────────

function mapFormula(row: any): FormulaDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    expression: row.expression,
    variables: row.variables as any[],
    returnType: row.return_type,
    unit: row.unit,
    precision: row.precision,
    isValidated: row.is_validated,
    validationErrors: row.validation_errors as any[] | null,
    dependencyGraph: row.dependency_graph as FormulaDependency[] | null,
    version: row.version,
    status: row.status,
    isSystem: row.is_system,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
