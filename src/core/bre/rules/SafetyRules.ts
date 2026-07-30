/**
 * M7.6E — Default Safety Rules (11 rules)
 *
 * Pre-built business rules for safety management.
 * Ship as draft — admin must activate.
 * Safety escalation chain runs 24/7 (no business-hours restriction).
 */

import type { CreateRuleInput } from '../RulesEngine';

type DefaultRule = Omit<CreateRuleInput, 'organizationId' | 'createdBy'>;

export const safetyDefaultRules: DefaultRule[] = [
  {
    slug: 'open_ptw_threshold',
    name: 'Open Permits Exceed Threshold',
    description: 'Alert when the number of open Permit-To-Work exceeds the configured limit',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.permit_status', 'open_count') > 50",
    evaluationMode: 'both',
    evaluationCron: '*/30 * * * *',
    eventTypes: ['permit.created', 'permit.updated'],
    severity: 'warning',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'permit', title: 'Open Permits Exceed Threshold' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'gas_test_expired',
    name: 'Gas Test Expired',
    description: 'Alert when gas test results have expired and work continues',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.gas_tests', 'expired_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '*/15 * * * *',
    severity: 'emergency',
    priority: 1,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'safety', title: 'Expired Gas Tests — Immediate Action Required' } },
      { actionType: 'notify', config: {} },
      { actionType: 'escalate', config: {} },
    ],
  },
  {
    slug: 'ppe_noncompliance',
    name: 'PPE Non-Compliance',
    description: 'Alert when PPE non-compliance observations exceed threshold',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.observations', 'ppe_noncompliance_count') > 3",
    evaluationMode: 'scheduled',
    evaluationCron: '0 */4 * * *',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'safety', title: 'PPE Non-Compliance Observed' } },
    ],
  },
  {
    slug: 'near_miss_spike',
    name: 'Near Miss Spike',
    description: 'Alert when near miss reports spike above daily average',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.incident_summary', 'near_miss_today') > PROVIDER('safety.incident_summary', 'near_miss_daily_avg') * 2",
    evaluationMode: 'scheduled',
    evaluationCron: '0 */4 * * *',
    severity: 'warning',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'trend', title: 'Near Miss Spike Detected' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'lti_occurrence',
    name: 'LTI Occurrence',
    description: 'Immediate alert on any Lost Time Injury',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.incident_summary', 'lti_today') > 0",
    evaluationMode: 'event_driven',
    eventTypes: ['incident.created', 'incident.updated'],
    severity: 'emergency',
    priority: 1,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'safety', title: 'Lost Time Injury Reported' } },
      { actionType: 'notify', config: {} },
      { actionType: 'escalate', config: {} },
    ],
  },
  {
    slug: 'emergency_equipment_expired',
    name: 'Emergency Equipment Expired',
    description: 'Alert when safety equipment inspections are overdue',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.equipment_status', 'overdue_inspection_count') > 0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 6 * * *',
    severity: 'critical',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'inspection', title: 'Emergency Equipment Inspection Overdue' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'hot_work_without_permit',
    name: 'Hot Work Without Permit',
    description: 'Alert when hot work activities lack a valid permit',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.permit_status', 'hot_work_no_permit_count') > 0",
    evaluationMode: 'both',
    evaluationCron: '*/15 * * * *',
    eventTypes: ['activity.started'],
    severity: 'emergency',
    priority: 1,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'permit', title: 'Hot Work Without Valid Permit' } },
      { actionType: 'notify', config: {} },
      { actionType: 'escalate', config: {} },
    ],
  },
  {
    slug: 'safety_observation_backlog',
    name: 'Safety Observation Backlog',
    description: 'Alert when unresolved safety observations exceed backlog threshold',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.observations', 'unresolved_count') > 20",
    evaluationMode: 'scheduled',
    evaluationCron: '0 8 * * *',
    severity: 'warning',
    priority: 4,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'safety', title: 'Safety Observation Backlog Growing' } },
    ],
  },
  {
    slug: 'unsafe_condition_trend',
    name: 'Unsafe Condition Trend',
    description: 'Alert when unsafe condition reports show an increasing trend',
    category: 'safety',
    conditionExpression: "TREND(PROVIDER('safety.observations', 'unsafe_condition_weekly')) > 0.5",
    evaluationMode: 'scheduled',
    evaluationCron: '0 8 * * 1',
    severity: 'warning',
    priority: 3,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'trend', title: 'Unsafe Condition Reports Trending Up' } },
    ],
  },
  {
    slug: 'trir_above_target',
    name: 'TRIR Above Target',
    description: 'Alert when Total Recordable Incident Rate exceeds target',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.incident_summary', 'trir') > 1.0",
    evaluationMode: 'scheduled',
    evaluationCron: '0 6 * * *',
    severity: 'critical',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'threshold', title: 'TRIR Above Target' } },
      { actionType: 'notify', config: {} },
    ],
  },
  {
    slug: 'first_aid_cluster',
    name: 'First Aid Case Cluster',
    description: 'Alert when multiple first aid cases occur in same area within 24h',
    category: 'safety',
    conditionExpression: "PROVIDER('safety.incident_summary', 'first_aid_24h') >= 3",
    evaluationMode: 'event_driven',
    eventTypes: ['incident.created'],
    severity: 'warning',
    priority: 2,
    actions: [
      { actionType: 'create_alert', config: { alert_type: 'trend', title: 'First Aid Case Cluster Detected' } },
      { actionType: 'notify', config: {} },
    ],
  },
];
