import { KnowledgeCaptureService } from './KnowledgeCaptureService';
import type { KnowledgeAssetCategory } from './types';

/** Non-blocking capture after a successful tenant write. */
export function enqueueKnowledgeCapture(input: {
  organizationId: string;
  category: KnowledgeAssetCategory;
  assetType: string;
  title: string;
  payload: Record<string, unknown>;
}): void {
  void KnowledgeCaptureService.captureAfterTenantSave(input);
}

export function formTemplateCategory(formType: string): KnowledgeAssetCategory {
  const t = (formType || '').toLowerCase();
  if (t.includes('safety') || t.includes('jsa') || t.includes('permit') || t.includes('hse')) {
    return 'SAFETY_TEMPLATE';
  }
  return 'QA_QC_TEMPLATE';
}
