export const ATTACHMENT_GROUPS = [
  {
    key: 'procedures',
    label: 'Procedures',
    icon: '📄',
    description: 'Work procedures, method statements, and technical protocols.',
    templates: [
      { key: 'method_statement', label: 'AI Method Statement' },
      { key: 'standard_procedure', label: 'Standard Work Procedure' },
    ]
  },
  {
    key: 'jsas',
    label: 'Job Safety Analysis',
    icon: '🛡️',
    description: 'Risk assessments and safety protocols from the JSA Library.',
    templates: [
      { key: 'jsa_library', label: 'Select from JSA Library' },
    ]
  },
  {
    key: 'checklists',
    label: 'Checklists',
    icon: '✅',
    description: 'Flange box-up, torquing, and inspection checklists.',
    templates: [
      { key: 'flange_boxup', label: '2.4 Flange Joint Box-up' },
      { key: 'torquing_checklist', label: '2.5 Torquing Checklist' },
      { key: 'inspection_checklist', label: 'Inspection Checklist' },
    ]
  },
  {
    key: 'reports',
    label: 'Test Reports',
    icon: '📊',
    description: 'NDT reports, hydrotest logs, and final inspection reports.',
    templates: [
      { key: 'hydrotest_report', label: 'Hydrotest / Pressure Report' },
      { key: 'ndt_report', label: 'NDT Report' },
    ]
  },
  {
    key: 'certificates',
    label: 'DOR / Readiness',
    icon: '🏅',
    description: 'Degree of Readiness (DOR) and compliance certificates.',
    templates: [
      { key: 'dor_table', label: 'DOR Readiness Table' },
      { key: 'calibration_cert', label: 'Calibration Certificate' },
    ]
  },
] as const;

export type AttachmentGroupKey = (typeof ATTACHMENT_GROUPS)[number]['key'];

export const ATTACHMENT_GROUP_MAP = Object.fromEntries(
  ATTACHMENT_GROUPS.map((g) => [g.key, g])
) as Record<AttachmentGroupKey, (typeof ATTACHMENT_GROUPS)[number]>;
