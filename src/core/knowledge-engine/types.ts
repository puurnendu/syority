export type KnowledgeAssetCategory =
  | 'ACTIVITY_CODE'
  | 'UDF_DEFINITION'
  | 'WORKPACK_TEMPLATE'
  | 'EQUIPMENT_TYPE'
  | 'RESOURCE_TYPE'
  | 'CERTIFICATE_TEMPLATE'
  | 'PRINT_SETTINGS'
  | 'QA_QC_TEMPLATE'
  | 'SAFETY_TEMPLATE';

/** Operational / project entities that must NEVER be collected. */
export const FORBIDDEN_KNOWLEDGE_COLLECT = [
  'WORKPACK',
  'EQUIPMENT_TAG',
  'SCHEDULE',
  'COST',
  'CONTRACTOR',
  'DOCUMENT',
  'DRAWING',
  'PROGRESS',
  'PERSONNEL',
  'SHUTDOWN_REPORT',
] as const;

export type KnowledgeCaptureInput = {
  organizationId: string;
  category: KnowledgeAssetCategory;
  assetType: string;
  title: string;
  /** Raw tenant record — will be sanitized before persistence */
  payload: Record<string, unknown>;
};

export type AiRecommendation = 'NEW' | 'MERGE' | 'DUPLICATE' | 'REJECT';
