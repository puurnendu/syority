/**
 * M7.6B — Report Engine
 *
 * Enterprise Reporting Engine that extends the M7.6A Report Builder.
 * Consumes Data Providers, produces reports, delivers via Notification Platform.
 */

// ─── Data Provider Framework ────────────────────────────────────────────────
export { BaseProvider, providerRegistry, type ProviderContext, type ProviderMeta } from './providers';

// ─── Services ───────────────────────────────────────────────────────────────
export { BrandingService, type ResolvedBranding } from './BrandingService';
export { SavedViewService } from './SavedViewService';
export { ArtifactService } from './ArtifactService';
export { AiReportAssistant, type AnalysisType } from './AiReportAssistant';

// ─── Re-exports from M7.6A (backward compat) ───────────────────────────────
export type { DataFetcherResult, DataFetcher } from './data-fetchers';
