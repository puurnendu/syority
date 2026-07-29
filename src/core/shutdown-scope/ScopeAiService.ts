import { prisma } from '@/lib/prisma';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';
import { callSyorityAI } from '@/lib/ai/universalAiClient';
import { parseVisionJson } from '@/services/ai/VisionAiService';

export class ScopeAiService {
  /**
   * AI scope recommendations for unscoped assets/issues.
   * Returns include/exclude recommendation with confidence for each.
   */
  static async recommendScope(orgId: string, scopeId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
      include: {
        event: {
          include: {
            eventUnits: { select: { unit_id: true } },
          },
        },
      },
    });
    if (!scope) throw new Error('Scope not found');

    const unitIds = scope.event.eventUnits.map((u) => u.unit_id);

    // Already-scoped asset IDs
    const scopedAssetIds = new Set(
      (await prisma.scopeItem.findMany({
        where: { scope_id: scopeId, deleted_at: null },
        select: { asset_id: true },
      })).map((i) => i.asset_id)
    );

    // Get unscoped issues with assets
    const unscopedIssues = await prisma.engineeringIssue.findMany({
      where: {
        organization_id: orgId,
        asset_id: { not: null, notIn: [...scopedAssetIds] },
        unit_id: { in: unitIds },
        deleted_at: null,
        status: { in: ['draft', 'matched', 'pending_review'] },
      },
      include: {
        asset: { select: { id: true, tag_number: true, name: true, criticality: true, asset_type: true } },
      },
      take: 100,
    });

    if (unscopedIssues.length === 0) {
      return { recommendations: [], message: 'All matched issues are already in scope' };
    }

    // Group by asset
    const assetGroups = new Map<string, typeof unscopedIssues>();
    for (const issue of unscopedIssues) {
      const key = issue.asset_id!;
      if (!assetGroups.has(key)) assetGroups.set(key, []);
      assetGroups.get(key)!.push(issue);
    }

    // Build AI prompt
    const issuesSummary = [...assetGroups.entries()].map(([assetId, issues]) => {
      const asset = issues[0].asset!;
      return {
        asset_tag: asset.tag_number,
        asset_name: asset.name,
        asset_type: asset.asset_type,
        criticality: asset.criticality,
        issue_count: issues.length,
        issues: issues.map((i) => ({
          problem: i.problem?.slice(0, 200),
          priority: i.priority,
          discipline: i.discipline || i.ai_discipline,
          failure_mode: i.ai_failure_mode,
        })),
      };
    });

    const prompt = `You are an industrial shutdown scope advisor for a refinery/petrochemical plant.

Analyse the following engineering issues grouped by asset and recommend whether each asset should be INCLUDED or EXCLUDED from this shutdown scope.

Consider:
- Asset criticality (critical/high = more likely include)
- Issue severity and count (multiple issues = stronger case)
- Failure modes (safety-related = must include)
- Discipline coverage (balance across disciplines)

For each asset, provide:
- recommendation: "include" or "exclude"
- confidence: 0.0 to 1.0
- reasoning: brief explanation
- suggested_discipline: primary discipline for this work
- suggested_template: workpack template type if included
- grouping_hint: how it should be packaged (by discipline, area, etc.)
- missing_documents: any documents that should be gathered

Assets and Issues:
${JSON.stringify(issuesSummary, null, 2)}

Return JSON:
{
  "recommendations": [
    {
      "asset_tag": "string",
      "recommendation": "include" | "exclude",
      "confidence": 0.0-1.0,
      "reasoning": "string",
      "suggested_discipline": "string",
      "suggested_template": "string or null",
      "grouping_hint": "string",
      "missing_documents": ["string"]
    }
  ]
}`;

    try {
      const provider = await loadProviderForJob(orgId, 'scope_recommendation');
      const result = await callSyorityAI(provider.model, prompt, {
        systemPrompt: 'You are an expert industrial shutdown scope advisor. Return valid JSON only.',
        maxTokens: 4000,
      });

      const parsed = parseVisionJson<{ recommendations: any[] }>(result.content);

      // Enrich with asset IDs
      const tagToId = new Map<string, string>();
      for (const [id, issues] of assetGroups) {
        tagToId.set(issues[0].asset!.tag_number, id);
      }

      const enriched = parsed.recommendations.map((r: any) => ({
        ...r,
        asset_id: tagToId.get(r.asset_tag),
        issue_count: assetGroups.get(tagToId.get(r.asset_tag) || '')?.length || 0,
      }));

      return { recommendations: enriched };
    } catch (error: any) {
      console.error('AI scope recommendation failed:', error);
      // Fallback: recommend all critical/high priority items
      const fallback = [...assetGroups.entries()].map(([assetId, issues]) => ({
        asset_id: assetId,
        asset_tag: issues[0].asset!.tag_number,
        recommendation: issues.some((i) => i.priority === 'critical' || i.priority === 'high') ? 'include' : 'review',
        confidence: 0.5,
        reasoning: 'AI unavailable — fallback based on issue priority',
        suggested_discipline: issues[0].discipline || issues[0].ai_discipline || 'General',
        suggested_template: null,
        grouping_hint: issues[0].discipline || 'General',
        missing_documents: [],
        issue_count: issues.length,
      }));
      return { recommendations: fallback, fallback: true };
    }
  }
}
