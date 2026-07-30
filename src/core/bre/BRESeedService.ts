/**
 * M7.6E — BRE Seed Service
 *
 * Seeds default rules, escalation chains, and formulas for new organizations.
 * Called from organization onboarding.
 */

import { RulesEngine } from './RulesEngine';
import { EscalationEngine } from './EscalationEngine';
import { FormulaService } from './FormulaService';
import { planningDefaultRules } from './rules/PlanningRules';
import { safetyDefaultRules } from './rules/SafetyRules';
import { executionDefaultRules } from './rules/ExecutionRules';
import { logger } from '@/lib/logger';

export class BRESeedService {

  /**
   * Seed all default BRE content for an organization.
   */
  static async seedOrganization(organizationId: string, userId: string): Promise<{
    rules: number;
    chains: number;
    formulas: number;
  }> {
    let rules = 0;
    let chains = 0;
    let formulas = 0;

    // 1. Seed escalation chains
    const defaultChains = EscalationEngine.getDefaultChains();
    const chainMap: Record<string, string> = {};

    for (const chainDef of defaultChains) {
      try {
        const chain = await EscalationEngine.createChain({
          ...chainDef,
          organizationId,
          createdBy: userId,
        });
        chainMap[chainDef.category] = chain.id;
        chains++;
      } catch (err: any) {
        logger.warn('BRESeed', `Failed to seed chain '${chainDef.name}': ${err.message}`);
      }
    }

    // 2. Seed default formulas
    const defaultFormulas = getDefaultFormulas();
    for (const formulaDef of defaultFormulas) {
      try {
        await FormulaService.create({
          ...formulaDef,
          organizationId,
          ownerId: userId,
          createdBy: userId,
        });
        formulas++;
      } catch (err: any) {
        logger.warn('BRESeed', `Failed to seed formula '${formulaDef.name}': ${err.message}`);
      }
    }

    // 3. Seed default rules
    const allRules = [...planningDefaultRules, ...safetyDefaultRules, ...executionDefaultRules];

    for (const ruleDef of allRules) {
      try {
        // Map escalation chain for the category
        const chainId = chainMap[ruleDef.category] ?? chainMap['planning'];

        await RulesEngine.create({
          ...ruleDef,
          organizationId,
          createdBy: userId,
          escalationChainId: ruleDef.actions?.some((a) => a.actionType === 'escalate') ? chainId : undefined,
        });
        rules++;
      } catch (err: any) {
        logger.warn('BRESeed', `Failed to seed rule '${ruleDef.name}': ${err.message}`);
      }
    }

    logger.info('BRESeed', `Seeded org ${organizationId}: ${rules} rules, ${chains} chains, ${formulas} formulas`);

    return { rules, chains, formulas };
  }
}

// ─── Default Formulas ───────────────────────────────────────────────────────

function getDefaultFormulas() {
  return [
    {
      slug: 'spi',
      name: 'Schedule Performance Index',
      description: 'SPI = Earned Value / Planned Value',
      category: 'planning',
      expression: "PROVIDER('planning.earned_value', 'ev') / PROVIDER('planning.planned_value', 'pv')",
      returnType: 'number',
      unit: 'ratio',
      precision: 3,
    },
    {
      slug: 'cpi',
      name: 'Cost Performance Index',
      description: 'CPI = Earned Value / Actual Cost',
      category: 'planning',
      expression: "PROVIDER('planning.earned_value', 'ev') / PROVIDER('planning.actual_cost', 'ac')",
      returnType: 'number',
      unit: 'ratio',
      precision: 3,
    },
    {
      slug: 'ppc',
      name: 'Percent Plan Complete',
      description: 'PPC = Tasks completed on-time / Tasks planned',
      category: 'planning',
      expression: "PERCENTAGE(PROVIDER('planning.daily_progress', 'completed_ontime'), PROVIDER('planning.daily_progress', 'total_planned'))",
      returnType: 'percentage',
      unit: '%',
      precision: 1,
    },
    {
      slug: 'trir',
      name: 'Total Recordable Incident Rate',
      description: 'TRIR = (Total Recordable Incidents × 200000) / Total Hours Worked',
      category: 'safety',
      expression: "(PROVIDER('safety.incident_summary', 'recordable_count') * 200000) / PROVIDER('workforce.manhours', 'total_hours')",
      returnType: 'number',
      unit: 'per 200k hrs',
      precision: 2,
    },
    {
      slug: 'ltifr',
      name: 'Lost Time Injury Frequency Rate',
      description: 'LTIFR = (LTIs × 1000000) / Total Hours Worked',
      category: 'safety',
      expression: "(PROVIDER('safety.incident_summary', 'lti_count') * 1000000) / PROVIDER('workforce.manhours', 'total_hours')",
      returnType: 'number',
      unit: 'per 1M hrs',
      precision: 2,
    },
    {
      slug: 'crew_utilization',
      name: 'Crew Utilization Rate',
      description: 'Actual working hours / Available hours',
      category: 'execution',
      expression: "PERCENTAGE(PROVIDER('workforce.manhours', 'actual_working'), PROVIDER('workforce.manhours', 'available'))",
      returnType: 'percentage',
      unit: '%',
      precision: 1,
    },
    {
      slug: 'weld_rejection_rate',
      name: 'Weld Rejection Rate',
      description: 'Percentage of welds rejected at inspection',
      category: 'execution',
      expression: "PERCENTAGE(PROVIDER('execution.welding_progress', 'rejected_joints'), PROVIDER('execution.welding_progress', 'total_joints'))",
      returnType: 'percentage',
      unit: '%',
      precision: 1,
    },
  ];
}
