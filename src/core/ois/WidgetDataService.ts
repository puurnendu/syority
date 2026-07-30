/**
 * M7.6C — Widget Data Service
 *
 * Orchestrates provider calls with caching.
 * Widgets fetch data exclusively through this service — never calling providers directly.
 *
 * Flow: Widget → WidgetDataService → cache check → ProviderRegistry.fetch() → cache store → Widget
 *
 * Batch mode deduplicates identical provider+params across multiple widgets.
 */

import { prisma } from '@/lib/prisma';
import { providerRegistry, type ProviderContext } from '@/core/report-engine/providers';
import type { DataFetcherResult } from '@/core/report-engine/data-fetchers';
import crypto from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL_SECONDS = 300; // 5 minutes

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashParams(params: Record<string, any>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

// ─── Service ────────────────────────────────────────────────────────────────

export class WidgetDataService {

  /**
   * Fetch data for a single widget.
   * Checks cache first, then calls the ProviderRegistry.
   */
  static async fetchWidgetData(opts: {
    providerKey: string;
    params: Record<string, any>;
    organizationId: string;
    cacheTtlSeconds?: number;
    skipCache?: boolean;
  }): Promise<DataFetcherResult> {
    const { providerKey, params, organizationId } = opts;
    const cacheTtl = opts.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    const paramsHash = hashParams(params);

    // 1. Check cache
    if (!opts.skipCache) {
      const cached = await WidgetDataService.getCached(providerKey, organizationId, paramsHash);
      if (cached) return cached;
    }

    // 2. Fetch from provider
    const ctx: ProviderContext = { organizationId };
    const data = await providerRegistry.fetch(providerKey, ctx, params);

    // 3. Store in cache
    await WidgetDataService.setCache(providerKey, organizationId, paramsHash, data, cacheTtl);

    return data;
  }

  /**
   * Batch fetch data for multiple widgets.
   * Deduplicates identical provider+params combinations.
   */
  static async batchFetch(opts: {
    widgets: Array<{
      id: string;
      providerKey: string;
      params: Record<string, any>;
    }>;
    organizationId: string;
    cacheTtlSeconds?: number;
    skipCache?: boolean;
  }): Promise<Map<string, DataFetcherResult>> {
    const results = new Map<string, DataFetcherResult>();
    const fetchMap = new Map<string, { widgetIds: string[]; providerKey: string; params: Record<string, any> }>();

    // Deduplicate by provider+params
    for (const widget of opts.widgets) {
      const hash = `${widget.providerKey}::${hashParams(widget.params)}`;
      if (fetchMap.has(hash)) {
        fetchMap.get(hash)!.widgetIds.push(widget.id);
      } else {
        fetchMap.set(hash, {
          widgetIds: [widget.id],
          providerKey: widget.providerKey,
          params: widget.params,
        });
      }
    }

    // Fetch each unique combination
    const fetchPromises = Array.from(fetchMap.values()).map(async (entry) => {
      try {
        const data = await WidgetDataService.fetchWidgetData({
          providerKey: entry.providerKey,
          params: entry.params,
          organizationId: opts.organizationId,
          cacheTtlSeconds: opts.cacheTtlSeconds,
          skipCache: opts.skipCache,
        });
        // Assign result to all widgets that share this provider+params
        for (const widgetId of entry.widgetIds) {
          results.set(widgetId, data);
        }
      } catch (err: any) {
        const errorResult: DataFetcherResult = {
          rows: [],
          kpis: [],
          metadata: { error: err.message },
        };
        for (const widgetId of entry.widgetIds) {
          results.set(widgetId, errorResult);
        }
      }
    });

    await Promise.all(fetchPromises);
    return results;
  }

  /**
   * Invalidate cache for a provider key (optionally scoped to org).
   */
  static async invalidateCache(providerKey: string, organizationId?: string) {
    const where: any = { provider_key: providerKey };
    if (organizationId) where.organization_id = organizationId;
    await prisma.ois_widget_data_cache.deleteMany({ where });
  }

  /**
   * Invalidate all cache for an organization.
   */
  static async invalidateOrgCache(organizationId: string) {
    await prisma.ois_widget_data_cache.deleteMany({
      where: { organization_id: organizationId },
    });
  }

  /**
   * Clean expired cache entries.
   */
  static async cleanExpiredCache() {
    await prisma.ois_widget_data_cache.deleteMany({
      where: { expires_at: { lte: new Date() } },
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private static async getCached(
    providerKey: string,
    organizationId: string,
    paramsHash: string,
  ): Promise<DataFetcherResult | null> {
    const cached = await prisma.ois_widget_data_cache.findUnique({
      where: {
        provider_key_organization_id_params_hash: {
          provider_key: providerKey,
          organization_id: organizationId,
          params_hash: paramsHash,
        },
      },
    });

    if (!cached || cached.expires_at < new Date()) return null;

    // Increment hit count (fire and forget)
    prisma.ois_widget_data_cache.update({
      where: { id: cached.id },
      data: { hit_count: { increment: 1 } },
    }).catch(() => { /* ignore */ });

    return cached.cached_data as DataFetcherResult;
  }

  private static async setCache(
    providerKey: string,
    organizationId: string,
    paramsHash: string,
    data: DataFetcherResult,
    ttlSeconds: number,
  ) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await prisma.ois_widget_data_cache.upsert({
      where: {
        provider_key_organization_id_params_hash: {
          provider_key: providerKey,
          organization_id: organizationId,
          params_hash: paramsHash,
        },
      },
      create: {
        provider_key: providerKey,
        organization_id: organizationId,
        params_hash: paramsHash,
        cached_data: data as any,
        fetched_at: new Date(),
        expires_at: expiresAt,
      },
      update: {
        cached_data: data as any,
        fetched_at: new Date(),
        expires_at: expiresAt,
        hit_count: 0,
      },
    });
  }
}
