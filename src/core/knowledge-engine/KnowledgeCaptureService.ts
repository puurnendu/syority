import { prisma } from '@/lib/prisma';
import { knowledgeEngineQueue } from '@/lib/queues';
import { contentHash, hashOrgId, sanitizeObject } from './sanitize';
import type { KnowledgeCaptureInput } from './types';
import { FORBIDDEN_KNOWLEDGE_COLLECT } from './types';

/**
 * Fire-and-forget capture after a successful tenant save.
 * Never throws into the tenant request path.
 */
export class KnowledgeCaptureService {
  static async captureAfterTenantSave(input: KnowledgeCaptureInput): Promise<void> {
    try {
      if ((FORBIDDEN_KNOWLEDGE_COLLECT as readonly string[]).includes(input.category)) {
        console.warn('[KnowledgeEngine] Refused forbidden category', input.category);
        return;
      }

      const org = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { industry: true, tenant_type: true },
      });

      // Platform org writes are already "standard" — skip collecting into Incoming
      if ((org?.tenant_type || '').toLowerCase() === 'platform') return;

      const sanitized = sanitizeObject(input.payload);
      // Enrich with hierarchy metadata for better AI matching
      if (input.hierarchy) {
        const h = input.hierarchy;
        if (h.equipment_type) (sanitized as any)._equipment_type = h.equipment_type;
        if (h.equipment_category) (sanitized as any)._equipment_category = h.equipment_category;
        if (h.discipline) (sanitized as any)._discipline = h.discipline;
        if (h.industry) (sanitized as any)._industry = h.industry;
        if (h.hierarchy_path) (sanitized as any)._hierarchy_path = h.hierarchy_path;
      }
      const title = (input.title || 'Untitled').trim().slice(0, 240);
      const hash = contentHash(input.category, title, sanitized);
      const orgHash = hashOrgId(input.organizationId);

      const existing = await prisma.knowledgeAsset.findFirst({
        where: { content_hash: hash, category: input.category as any },
        orderBy: { last_seen_at: 'desc' },
      });

      if (existing) {
        await prisma.knowledgeAsset.update({
          where: { id: existing.id },
          data: {
            last_seen_at: new Date(),
            times_seen: { increment: 1 },
            times_used: { increment: 1 },
            source_industry: org?.industry ?? existing.source_industry,
            source_org_hash: orgHash,
          },
        });
        // Re-queue only if still incoming / analysis
        if (existing.status === 'INCOMING' || existing.status === 'AI_ANALYSIS') {
          await enqueueSafe(existing.id);
        }
        return;
      }

      const asset = await prisma.knowledgeAsset.create({
        data: {
          status: 'INCOMING',
          category: input.category as any,
          asset_type: input.assetType,
          title,
          content_hash: hash,
          sanitized_payload: sanitized as any,
          source_industry: org?.industry ?? null,
          source_org_hash: orgHash,
          times_used: 1,
        },
      });

      await enqueueSafe(asset.id);
    } catch (err) {
      console.error('[KnowledgeEngine] Capture failed (tenant save unaffected):', err);
    }
  }
}

async function enqueueSafe(assetId: string) {
  // Always kick analysis asynchronously in-process so Review Queue fills
  // even when the dedicated worker process is not running (common in Docker app-only).
  void import('./KnowledgeAnalysisService')
    .then(({ KnowledgeAnalysisService }) => KnowledgeAnalysisService.analyzeAsset(assetId))
    .catch((e) => console.error('[KnowledgeEngine] Inline analysis failed:', e));

  try {
    await knowledgeEngineQueue.add(
      'analyze',
      { assetId },
      { jobId: `ke-analyze-${assetId}`, removeOnComplete: 50, removeOnFail: 25 }
    );
  } catch (err) {
    // Redis down must not block tenants
    console.error('[KnowledgeEngine] Enqueue failed (inline analysis already started):', err);
  }
}
