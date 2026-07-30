/**
 * M7.6E — Rules Engine
 *
 * Metadata-driven business rules evaluation.
 * Conditions are parsed by FormulaEngine.
 * Actions dispatch to Notification Platform, Escalation Engine, or internal handlers.
 *
 * Architecture:
 *   Rule Definition → Condition Expression → FormulaEngine → Action Dispatch
 *     ↓ notify    → NotificationRuleEngine.processEvent()
 *     ↓ escalate  → EscalationEngine.escalate()
 *     ↓ alert     → AlertEngine.createAlert()
 *     ↓ log       → bre_evaluation_log
 */

import { prisma } from '@/lib/prisma';
import { evaluateExpression, type EvaluationContext } from './FormulaEngine';
import { processEvent } from '@/core/notifications/NotificationRuleEngine';
import type { ProviderContext } from '@/core/report-engine/providers/BaseProvider';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RuleDefinition {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  conditionExpression: string;
  conditionVariables: any[];
  evaluationMode: string;
  evaluationCron: string | null;
  eventTypes: string[];
  scopeSiteId: string | null;
  scopeUnitId: string | null;
  scopeArea: string | null;
  scopeEquipment: string | null;
  scopeWorkpackId: string | null;
  scopeShift: string | null;
  priority: number;
  severity: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  approvalStatus: string;
  isEnabled: boolean;
  isSystem: boolean;
  version: number;
  escalationChainId: string | null;
  actions: RuleAction[];
}

export interface RuleAction {
  id: string;
  ruleId: string;
  actionType: string;
  config: any;
  sortOrder: number;
  isEnabled: boolean;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleSlug: string;
  passed: boolean;
  resultValue: any;
  durationMs: number;
  actionsExecuted: number;
  error?: string;
}

export interface CreateRuleInput {
  organizationId: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  conditionExpression: string;
  conditionVariables?: any[];
  evaluationMode?: string;
  evaluationCron?: string;
  eventTypes?: string[];
  scopeSiteId?: string;
  scopeUnitId?: string;
  scopeArea?: string;
  scopeEquipment?: string;
  scopeWorkpackId?: string;
  scopeShift?: string;
  priority?: number;
  severity?: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  escalationChainId?: string;
  createdBy: string;
  actions?: Array<{
    actionType: string;
    config: any;
    sortOrder?: number;
  }>;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class RulesEngine {

  /**
   * Create a new business rule with actions.
   */
  static async create(input: CreateRuleInput): Promise<RuleDefinition> {
    const rule = await prisma.bre_rules.create({
      data: {
        organization_id: input.organizationId,
        slug: input.slug,
        name: input.name,
        description: input.description,
        category: input.category,
        condition_expression: input.conditionExpression,
        condition_variables: input.conditionVariables ?? [],
        evaluation_mode: input.evaluationMode ?? 'scheduled',
        evaluation_cron: input.evaluationCron,
        event_types: input.eventTypes ?? [],
        scope_site_id: input.scopeSiteId,
        scope_unit_id: input.scopeUnitId,
        scope_area: input.scopeArea,
        scope_equipment: input.scopeEquipment,
        scope_workpack_id: input.scopeWorkpackId,
        scope_shift: input.scopeShift,
        priority: input.priority ?? 5,
        severity: input.severity ?? 'warning',
        effective_from: input.effectiveFrom,
        effective_until: input.effectiveUntil,
        escalation_chain_id: input.escalationChainId,
        is_enabled: true,
        approval_status: 'approved',
        created_by: input.createdBy,
        actions: {
          create: (input.actions ?? []).map((a, i) => ({
            action_type: a.actionType,
            config: a.config,
            sort_order: a.sortOrder ?? i,
            is_enabled: true,
          })),
        },
      },
      include: { actions: true },
    });

    return mapRule(rule);
  }

  /**
   * Evaluate a single rule.
   */
  static async evaluateRule(
    ruleId: string,
    ctx: ProviderContext,
    params: Record<string, any>,
  ): Promise<RuleEvaluationResult> {
    const start = Date.now();
    const rule = await prisma.bre_rules.findUniqueOrThrow({
      where: { id: ruleId },
      include: { actions: { where: { is_enabled: true }, orderBy: { sort_order: 'asc' } } },
    });

    // Check effective dates
    const now = new Date();
    if (rule.effective_from && now < rule.effective_from) {
      return { ruleId, ruleSlug: rule.slug, passed: false, resultValue: 'Not yet effective', durationMs: Date.now() - start, actionsExecuted: 0 };
    }
    if (rule.effective_until && now > rule.effective_until) {
      return { ruleId, ruleSlug: rule.slug, passed: false, resultValue: 'Expired', durationMs: Date.now() - start, actionsExecuted: 0 };
    }

    // Build variable context
    const variables: Record<string, any> = {};
    const condVars = (rule.condition_variables as any[]) ?? [];
    for (const v of condVars) {
      if (v.default !== undefined) variables[v.name] = v.default;
      if (params[v.name] !== undefined) variables[v.name] = params[v.name];
    }

    try {
      const evalCtx: EvaluationContext = {
        providerCtx: ctx,
        variables,
        providerParams: params,
        providerCache: new Map(),
      };

      const result = await evaluateExpression(rule.condition_expression, evalCtx);
      const passed = Boolean(result);

      // Log evaluation
      await prisma.bre_evaluation_log.create({
        data: {
          organization_id: ctx.organizationId,
          evaluation_type: 'rule',
          target_id: ruleId,
          target_slug: rule.slug,
          result_value: String(result),
          result_passed: passed,
          duration_ms: Date.now() - start,
          input_params: params,
        },
      });

      // Execute actions if condition passed
      let actionsExecuted = 0;
      if (passed) {
        actionsExecuted = await RulesEngine.executeActions(rule, ctx, params, result);
      }

      return {
        ruleId,
        ruleSlug: rule.slug,
        passed,
        resultValue: result,
        durationMs: Date.now() - start,
        actionsExecuted,
      };
    } catch (err: any) {
      // Log error
      await prisma.bre_evaluation_log.create({
        data: {
          organization_id: ctx.organizationId,
          evaluation_type: 'rule',
          target_id: ruleId,
          target_slug: rule.slug,
          result_passed: false,
          error_message: err.message,
          duration_ms: Date.now() - start,
          input_params: params,
        },
      });

      return {
        ruleId,
        ruleSlug: rule.slug,
        passed: false,
        resultValue: null,
        durationMs: Date.now() - start,
        actionsExecuted: 0,
        error: err.message,
      };
    }
  }

  /**
   * Execute all actions for a triggered rule.
   */
  private static async executeActions(
    rule: any,
    ctx: ProviderContext,
    params: Record<string, any>,
    triggerValue: any,
  ): Promise<number> {
    let executed = 0;

    for (const action of rule.actions) {
      try {
        const config = action.config as Record<string, any>;

        switch (action.action_type) {
          case 'notify':
            await processEvent('bre.alert.triggered', {
              organizationId: ctx.organizationId,
              triggeredBy: ctx.userId,
              entityType: 'rule',
              entityId: rule.id,
              variables: {
                rule_name: rule.name,
                severity: rule.severity,
                trigger_value: String(triggerValue),
                category: rule.category,
                description: rule.description ?? '',
                ...config.variables,
              },
            });
            executed++;
            break;

          case 'create_alert':
            await prisma.bre_alerts.create({
              data: {
                organization_id: ctx.organizationId,
                rule_id: rule.id,
                alert_type: config.alert_type ?? 'threshold',
                title: config.title ?? `${rule.name} triggered`,
                message: config.message ?? `Rule '${rule.name}' condition met. Value: ${triggerValue}`,
                severity: rule.severity,
                priority: rule.priority,
                entity_type: config.entity_type,
                entity_id: config.entity_id,
                scope_site_id: rule.scope_site_id,
                scope_unit_id: rule.scope_unit_id,
                scope_area: rule.scope_area,
                trigger_value: String(triggerValue),
                threshold_value: config.threshold_value ? String(config.threshold_value) : null,
                evaluation_data: params,
                status: 'open',
              },
            });
            executed++;
            break;

          case 'escalate':
            if (rule.escalation_chain_id) {
              // EscalationEngine will handle this
              await processEvent('bre.escalation.escalated', {
                organizationId: ctx.organizationId,
                triggeredBy: ctx.userId,
                entityType: 'rule',
                entityId: rule.id,
                variables: {
                  rule_name: rule.name,
                  chain_id: rule.escalation_chain_id,
                  severity: rule.severity,
                },
              });
            }
            executed++;
            break;

          case 'log':
            logger.info('RulesEngine', `Rule '${rule.name}' triggered: ${triggerValue}`);
            executed++;
            break;

          case 'webhook':
            // Future: HTTP POST to config.url
            logger.info('RulesEngine', `Webhook action for rule '${rule.name}' — URL: ${config.url ?? 'not configured'}`);
            executed++;
            break;

          default:
            logger.warn('RulesEngine', `Unknown action type: ${action.action_type}`);
        }
      } catch (err: any) {
        logger.error('RulesEngine', `Action '${action.action_type}' failed for rule '${rule.slug}': ${err.message}`);
      }
    }

    return executed;
  }

  /**
   * Evaluate all scheduled rules for an organization.
   */
  static async evaluateScheduledRules(
    organizationId: string,
    params: Record<string, any>,
  ): Promise<RuleEvaluationResult[]> {
    const rules = await prisma.bre_rules.findMany({
      where: {
        organization_id: organizationId,
        is_enabled: true,
        approval_status: 'approved',
        evaluation_mode: { in: ['scheduled', 'both'] },
      },
      orderBy: [{ priority: 'asc' }, { created_at: 'asc' }],
    });

    const ctx: ProviderContext = { organizationId };
    const results: RuleEvaluationResult[] = [];

    for (const rule of rules) {
      const result = await RulesEngine.evaluateRule(rule.id, ctx, params);
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate event-driven rules matching an event type.
   */
  static async evaluateEventRules(
    organizationId: string,
    eventType: string,
    params: Record<string, any>,
  ): Promise<RuleEvaluationResult[]> {
    const allRules = await prisma.bre_rules.findMany({
      where: {
        organization_id: organizationId,
        is_enabled: true,
        approval_status: 'approved',
        evaluation_mode: { in: ['event_driven', 'both'] },
      },
    });

    // Filter by event type (stored in JSON array)
    const matchingRules = allRules.filter((r) => {
      const types = (r.event_types as string[]) ?? [];
      return types.includes(eventType) || types.includes('*');
    });

    const ctx: ProviderContext = { organizationId };
    const results: RuleEvaluationResult[] = [];

    for (const rule of matchingRules) {
      const result = await RulesEngine.evaluateRule(rule.id, ctx, params);
      results.push(result);
    }

    return results;
  }

  /**
   * List rules for an organization.
   */
  static async list(organizationId: string, filters?: {
    category?: string;
    severity?: string;
    isEnabled?: boolean;
    search?: string;
  }): Promise<RuleDefinition[]> {
    const where: any = { organization_id: organizationId };
    if (filters?.category) where.category = filters.category;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.isEnabled !== undefined) where.is_enabled = filters.isEnabled;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const rules = await prisma.bre_rules.findMany({
      where,
      include: { actions: { orderBy: { sort_order: 'asc' } } },
      orderBy: [{ priority: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });

    return rules.map(mapRule);
  }

  /**
   * Get a rule by ID.
   */
  static async getById(id: string): Promise<RuleDefinition | null> {
    const rule = await prisma.bre_rules.findUnique({
      where: { id },
      include: { actions: { orderBy: { sort_order: 'asc' } } },
    });
    return rule ? mapRule(rule) : null;
  }

  /**
   * Enable/disable a rule.
   */
  static async setEnabled(id: string, enabled: boolean, updatedBy: string): Promise<void> {
    await prisma.bre_rules.update({
      where: { id },
      data: { is_enabled: enabled, updated_by: updatedBy },
    });
  }

  /**
   * Simulate a rule without executing actions.
   */
  static async simulate(
    conditionExpression: string,
    ctx: ProviderContext,
    params: Record<string, any>,
  ): Promise<{ passed: boolean; result: any; error?: string }> {
    try {
      const evalCtx: EvaluationContext = {
        providerCtx: ctx,
        variables: {},
        providerParams: params,
        providerCache: new Map(),
      };

      const result = await evaluateExpression(conditionExpression, evalCtx);
      return { passed: Boolean(result), result };
    } catch (err: any) {
      return { passed: false, result: null, error: err.message };
    }
  }
}

// ─── Mapper ─────────────────────────────────────────────────────────────────

function mapRule(row: any): RuleDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    conditionExpression: row.condition_expression,
    conditionVariables: row.condition_variables as any[],
    evaluationMode: row.evaluation_mode,
    evaluationCron: row.evaluation_cron,
    eventTypes: row.event_types as string[],
    scopeSiteId: row.scope_site_id,
    scopeUnitId: row.scope_unit_id,
    scopeArea: row.scope_area,
    scopeEquipment: row.scope_equipment,
    scopeWorkpackId: row.scope_workpack_id,
    scopeShift: row.scope_shift,
    priority: row.priority,
    severity: row.severity,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    approvalStatus: row.approval_status,
    isEnabled: row.is_enabled,
    isSystem: row.is_system,
    version: row.version,
    escalationChainId: row.escalation_chain_id,
    actions: (row.actions ?? []).map((a: any) => ({
      id: a.id,
      ruleId: a.rule_id,
      actionType: a.action_type,
      config: a.config,
      sortOrder: a.sort_order,
      isEnabled: a.is_enabled,
    })),
  };
}
