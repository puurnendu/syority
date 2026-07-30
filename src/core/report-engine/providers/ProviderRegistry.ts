/**
 * M7.6B — Provider Registry
 *
 * Central registry for all report data providers.
 * Supports runtime registration so future modules (RBI, Corrosion, etc.)
 * can add providers without modifying core logic.
 *
 * Also provides a backward-compatible DataFetcher adapter for M7.6A.
 */

import { BaseProvider, type ProviderContext, type ProviderMeta } from './BaseProvider';
import type { DataFetcher, DataFetcherResult } from '../data-fetchers';

// ─── Registry ───────────────────────────────────────────────────────────────

class ProviderRegistryClass {
  private providers = new Map<string, BaseProvider>();

  /**
   * Register a provider. Replaces any existing provider with the same key.
   */
  register(provider: BaseProvider): void {
    if (this.providers.has(provider.key)) {
      console.warn(`[ProviderRegistry] Replacing existing provider: ${provider.key}`);
    }
    this.providers.set(provider.key, provider);
  }

  /**
   * Register multiple providers at once.
   */
  registerAll(providers: BaseProvider[]): void {
    for (const p of providers) {
      this.register(p);
    }
  }

  /**
   * Get a provider by key.
   */
  get(key: string): BaseProvider | undefined {
    return this.providers.get(key);
  }

  /**
   * Check if a provider is registered.
   */
  has(key: string): boolean {
    return this.providers.has(key);
  }

  /**
   * List all registered provider keys.
   */
  keys(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * List all providers grouped by category.
   */
  listByCategory(): Record<string, ProviderMeta[]> {
    const result: Record<string, ProviderMeta[]> = {};
    for (const provider of this.providers.values()) {
      const meta = provider.getMeta();
      if (!result[meta.category]) result[meta.category] = [];
      result[meta.category].push(meta);
    }
    return result;
  }

  /**
   * List all provider metadata.
   */
  listAll(): ProviderMeta[] {
    return Array.from(this.providers.values()).map((p) => p.getMeta());
  }

  /**
   * Fetch data from a provider by key.
   */
  async fetch(key: string, ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`[ProviderRegistry] No provider registered for key: ${key}`);
    }
    return provider.fetch(ctx, params);
  }

  /**
   * Create a backward-compatible DataFetcher adapter.
   * This allows the existing M7.6A dataFetcherRegistry to delegate to providers.
   */
  toDataFetcherMap(): Record<string, DataFetcher> {
    const map: Record<string, DataFetcher> = {};
    for (const [key, provider] of this.providers.entries()) {
      map[key] = async (orgId: string, params: Record<string, any>) => {
        return provider.fetch({ organizationId: orgId }, params);
      };
    }
    return map;
  }

  /**
   * Get provider count.
   */
  get size(): number {
    return this.providers.size;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const providerRegistry = new ProviderRegistryClass();
export { ProviderRegistryClass };
