/**
 * Asset Register — Core Service Layer Barrel Export
 *
 * M8.6 — Asset Register as Primary Master Layer.
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md (R2.1)
 */

// Services
export { AssetAttributeHistoryService, HISTORY_ACTIONS, ATTRIBUTE_STATUSES } from './AssetAttributeHistoryService';
export { AssetRegisterService } from './AssetRegisterService';
export { AssetRelationshipService, RELATIONSHIP_TYPES } from './AssetRelationshipService';
export { WorkpackAssetSnapshotService } from './WorkpackAssetSnapshotService';
export { AssetExtractionMapper } from './AssetExtractionMapper';

// Types
export type {
  HistoryAction,
  AttributeStatus,
  ValueFields,
  ProvenanceFields,
  AiProvenanceFields,
  RecordAiExtractionInput,
  RecordAiDecisionInput,
  RecordManualEntryInput,
  RecordVerificationInput,
  RecordSupersededInput,
} from './AssetAttributeHistoryService';

export type {
  SetValueContext,
  AttributeInput,
  ReviewDecision,
  ReviewOpts,
  VerifiedAttributeData,
  VerifiedAssetData,
} from './AssetRegisterService';

export type {
  RelationshipType,
  CreateRelationshipInput,
} from './AssetRelationshipService';
