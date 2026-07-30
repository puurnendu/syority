/**
 * M7.6E — Default Planning Rules (12 rules)
 *
 * Pre-built business rules for planning intelligence.
 * All conditions use FormulaEngine expressions reading from ProviderRegistry.
 * Ship as draft — admin must activate.
 */

import type { CreateRuleInput } from '../RulesEngine';

type DefaultRule = Omit<CreateRuleInput, 'organizationId' | 'createdBy'>;

export const planningDefaultRules: DefaultRule[] = [
  {
    slug: 'critical_path_slip',
    name: 'Critical Path Slip',
    description: 'Alert when critical path activities are behind schedule',
    category: 'planning',
    conditionExpression: "PROVIDER_COUNT('planning.critical_activities') > 0 AND PROVIDER('planning.schedule_performance', 'spi') < 0.95",
    evaluationMode: 'both',
    evaluationCron: '*/30 * * * *',
    eventTypes: ['activity.updated', 'activity.progress_updated'],
    severity: 'critical',
    priority: 1,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'critical_path', title: 'Critical Path Slip Detected', message: 'Critical activities are behind schedule. SPI is below 0.95.' } },
      { actionType: 'notify', config: { variables: { rule_name: 'Critical Path Slip' } } },
    ],
  },
  {
    slug: 'spi_below_target',
    name: 'SPI Below Target',
    description: 'Alert when Schedule Performance Index drops below 0.9',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.schedule_performance', 'spi') < 0.9",
    evaluationMode: 'scheduled',
    evaluationCron: '0 */4 * * *',
    severity: 'warning',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'schedule_health', title: 'SPI Below Target' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'logic_errors_detected',
    name: 'Logic Errors Detected',
    description: 'Alert when schedule logic errors are found',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.logic_health', 'error_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 6 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'deviation', title: 'Schedule Logic Errors Found' } },
    ],
  },
  {
    slug: 'negative_float',
    name: 'Negative Float Activities',
    description: 'Alert when activities have negative total float',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.float_distribution', 'negative_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 */6 * * *',
    severity: 'critical',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'schedule_health', title: 'Negative Float Detected' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'late_activities',
    name: 'Late Activities',
    description: 'Alert when activities exceed their planned finish date',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.late_activities', 'count') > 0",
    evaluationMode: 'both',
    evaluationCron: '0 7 * * *',
    eventTypes: ['activity.updated'],
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'late_activity', title: 'Late Activities Detected' } },
    ],
  },
  {
    slug: 'open_constraints',
    name: 'Open Constraints Overdue',
    description: 'Alert when constraints remain unresolved past their required date',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.constraint_register', 'overdue_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 8 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'deviation', title: 'Overdue Constraints' } },
    ],
  },
  {
    slug: 'missing_relationships',
    name: 'Missing Relationships',
    description: 'Alert when activities have no predecessors or successors',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.logic_health', 'missing_predecessor_count') > 5",
    evaluationMode: 'scheduled',
    evaluationCron: '0 6 * * 1',
    severity: 'information',
    priority: 5,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'deviation', title: 'Activities Missing Relationships' } },
    ],
  },
  {
    slug: 'missing_resources',
    name: 'Missing Resources',
    description: 'Alert when activities lack crew/resource assignments',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.resource_loading', 'unassigned_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 7 * * *',
    severity: 'warning',
    priority: 4,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'resource', title: 'Activities Without Resources' } },
    ],
  },
  {
    slug: 'ready_workpacks_low',
    name: 'Ready Workpacks Low',
    description: 'Alert when fewer than 3 workpacks are ready for the next 48 hours',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.workpack_readiness', 'ready_count') < 3",
    evaluationMode: 'scheduled',
    evaluationCron: '0 6,14 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'resource', title: 'Low Ready Workpack Count' } },
    ],
  },
  {
    slug: 'workpacks_without_drawings',
    name: 'Workpacks Without Drawings',
    description: 'Alert when active workpacks lack required drawings',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.workpack_readiness', 'missing_drawings_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 8 * * *',
    severity: 'information',
    priority: 5,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'missing_data', title: 'Workpacks Missing Drawings' } },
    ],
  },
  {
    slug: 'activities_without_udfs',
    name: 'Activities Without UDFs',
    description: 'Alert when activities are missing required UDF values',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.udf_completion', 'incomplete_count') > 10",
    evaluationMode: 'scheduled',
    evaluationCron: '0 7 * * 1',
    severity: 'information',
    priority: 6,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'missing_data', title: 'Activities Missing UDFs' } },
    ],
  },
  {
    slug: 'activities_without_contractor',
    name: 'Activities Without Contractor',
    description: 'Alert when scheduled activities have no contractor assigned',
    category: 'planning',
    conditionExpression: "PROVIDER('planning.resource_loading', 'no_contractor_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 7 * * *',
    severity: 'warning',
    priority: 4,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'missing_data', title: 'Activities Without Contractor' } },
    ],
  },
];
