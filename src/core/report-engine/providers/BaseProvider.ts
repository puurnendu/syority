/**
 * M7.6B — Base Report Data Provider
 *
 * Abstract base class for all report data providers.
 * Providers fetch structured data from business services (never raw Prisma).
 * The Report Engine consumes providers only.
 *
 * To add a new provider:
 *   1. Extend BaseProvider<TParams, TResult>
 *   2. Implement the abstract members (key, category, description, fetch)
 *   3. Register via ProviderRegistry.register(new YourProvider())
 */

import type { DataFetcherResult } from '../data-fetchers';

// ─── Context ────────────────────────────────────────────────────────────────

export interface ProviderContext {
  organizationId: string;
  userId?: string;
  tenantTimezone?: string;
}

// ─── Provider Metadata ──────────────────────────────────────────────────────

export interface ProviderMeta {
  key: string;
  category: string;
  name: string;
  description: string;
  module: string;
  requiredParams: string[];
  optionalParams: string[];
  supportsStreaming: boolean;
  supportsPagination: boolean;
  maxRows?: number;
}

// ─── Abstract Base ──────────────────────────────────────────────────────────

export abstract class BaseProvider {
  /** Unique key matching data_source_key on report_definitions. e.g. "planning.lookahead_24h" */
  abstract readonly key: string;

  /** Category grouping. e.g. "planning", "shutdown", "execution" */
  abstract readonly category: string;

  /** Human-readable name. e.g. "24 Hour Look Ahead" */
  abstract readonly name: string;

  /** Description of what this provider returns. */
  abstract readonly description: string;

  /** Source module — "core" for built-in, future modules use their own key */
  readonly module: string = 'core';

  /** Required parameter keys */
  readonly requiredParams: string[] = [];

  /** Optional parameter keys */
  readonly optionalParams: string[] = [];

  /** Whether this provider supports streaming large datasets */
  readonly supportsStreaming: boolean = false;

  /** Whether this provider supports pagination */
  readonly supportsPagination: boolean = false;

  /** Recommended maximum rows */
  readonly maxRows?: number;

  /**
   * Fetch structured data for report rendering.
   * Implementations MUST consume business services, never raw Prisma.
   */
  abstract fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult>;

  /**
   * Return provider metadata for self-documentation.
   */
  getMeta(): ProviderMeta {
    return {
      key: this.key,
      category: this.category,
      name: this.name,
      description: this.description,
      module: this.module,
      requiredParams: this.requiredParams,
      optionalParams: this.optionalParams,
      supportsStreaming: this.supportsStreaming,
      supportsPagination: this.supportsPagination,
      maxRows: this.maxRows,
    };
  }
}
