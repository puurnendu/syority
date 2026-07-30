/**
 * M7.6E — Default Execution Rules (10 rules)
 *
 * Pre-built business rules for execution management.
 * Ship as draft — admin must activate.
 */

import type { CreateRuleInput } from '../RulesEngine';

type DefaultRule = Omit<CreateRuleInput, 'organizationId' | 'createdBy'>;

export const executionDefaultRules: DefaultRule[] = [
  {
    slug: 'productivity_below_plan',
    name: 'Productivity Below Plan',
    description: 'Alert when actual productivity falls below planned threshold',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.productivity', 'actual_rate') < PROVIDER('execution.productivity', 'planned_rate') * 0.8",
    evaluationMode: 'scheduled',
    evaluationCron: '0 */4 * * *',
    severity: 'warning',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'execution', title: 'Productivity Below 80% of Plan' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'resource_underutilization',
    name: 'Resource Under-Utilization',
    description: 'Alert when crew utilization drops below 60%',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.resource_utilization', 'utilization_pct') < 60",
    evaluationMode: 'scheduled',
    evaluationCron: '0 10,14 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'resource', title: 'Resource Under-Utilization Detected' } },
    ],
  },
  {
    slug: 'crew_overutilization',
    name: 'Crew Over-Utilization',
    description: 'Alert when crew hours exceed 120% of planned capacity',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.resource_utilization', 'utilization_pct') > 120",
    evaluationMode: 'scheduled',
    evaluationCron: '0 10,14 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'resource', title: 'Crew Over-Utilization — Fatigue Risk' } },
    ],
  },
  {
    slug: 'equipment_delay',
    name: 'Equipment Delay',
    description: 'Alert when equipment delivery delays impact scheduled activities',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.equipment_status', 'delayed_count') > 0",
    evaluationMode: 'both',
    evaluationCron: '0 7 * * *',
    eventTypes: ['equipment.status_changed'],
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'execution', title: 'Equipment Delivery Delayed' } },
    ],
  },
  {
    slug: 'material_shortage',
    name: 'Material Shortage',
    description: 'Alert when materials required for upcoming activities are not available',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.material_status', 'shortage_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 6 * * *',
    severity: 'critical',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'resource', title: 'Material Shortage for Upcoming Activities' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'scaffold_delay',
    name: 'Scaffold Delay',
    description: 'Alert when scaffold erection/dismantle is behind schedule',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.scaffold_status', 'overdue_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 7 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'execution', title: 'Scaffold Activities Behind Schedule' } },
    ],
  },
  {
    slug: 'welding_delay',
    name: 'Welding Activities Behind',
    description: 'Alert when welding activities fall behind daily target',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.welding_progress', 'actual_joints') < PROVIDER('execution.welding_progress', 'target_joints') * 0.75",
    evaluationMode: 'scheduled',
    evaluationCron: '0 16 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'execution', title: 'Welding Progress Below 75% of Target' } },
    ],
  },
  {
    slug: 'inspection_hold',
    name: 'Inspection Hold Point',
    description: 'Alert when work is waiting at an inspection hold point for over 4 hours',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.inspection_holds', 'waiting_over_4h_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 */2 * * *',
    severity: 'warning',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'inspection', title: 'Inspection Hold — Waiting Over 4 Hours' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'qa_rejection_spike',
    name: 'QA Rejection Spike',
    description: 'Alert when QA rejection rate exceeds 10% in a shift',
    category: 'execution',
    conditionExpression: "PERCENTAGE(PROVIDER('execution.qa_results', 'rejected_count'), PROVIDER('execution.qa_results', 'total_count')) > 10",
    evaluationMode: 'scheduled',
    evaluationCron: '0 8,20 * * *',
    severity: 'critical',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'quality', title: 'QA Rejection Rate Exceeds 10%' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'commissioning_delay',
    name: 'Commissioning Delay',
    description: 'Alert when commissioning activities fall behind the integrated schedule',
    category: 'execution',
    conditionExpression: "PROVIDER('execution.commissioning_status', 'behind_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 8 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'execution', title: 'Commissioning Activities Behind Schedule' } },
    ],
  },
];
