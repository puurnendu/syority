/**
 * IssueDuplicateService — AI-powered duplicate detection.
 * Groups by asset, compares problem text, AI semantic analysis.
 * M7.2 — Engineering Scope Intelligence.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { callSyorityAI, SyorityAiConfig } from '@/lib/ai/universalAiClient';
import { parseVisionJson } from '@/services/ai/VisionAiService';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';

// ── Types ──────────────────────────────────────────

export type DuplicateDetectionResult = {
  pairs_detected: number;
  pairs_by_method: Record<string, number>;
};

export type DuplicateWithIssues = {
  id: string;
  similarity_score: number;
  similarity_method: string;
  ai_reasoning: string | null;
  resolution: string | null;
  issue_a: { id: string; issue_number: string | null; problem: string; equipment_tag_raw: string | null };
  issue_b: { id: string; issue_number: string | null; problem: string; equipment_tag_raw: string | null };
};

// ── AI Prompt ──────────────────────────────────────

const DUPLICATE_DETECTION_PROMPT = `
You are analysing engineering issues from an industrial plant to find duplicates.
Two issues are duplicates if they describe the SAME problem on the SAME equipment, even with different wording.

Examples of duplicates:
- "Leakage on pump seal" vs "Seal leak on pump" → DUPLICATE
- "Tube leakage on E-1001A" vs "Heat exchanger E-1001A tube failure" → DUPLICATE
- "Vibration on P-2003" vs "P-2003 bearing wear" → LIKELY RELATED but could be different root causes

For each pair, respond with:
- is_duplicate: true/false
- confidence: 0.0–1.0
- reasoning: brief explanation

Return ONLY valid JSON:
{
  "pairs": [
    {
      "pair_index": number,
      "is_duplicate": boolean,
      "confidence": number,
      "reasoning": string
    }
  ]
}
`;

// ── Service ────────────────────────────────────────

export class IssueDuplicateService {
  /**
   * Detect duplicates within a batch or across all issues for an org.
   */
  static async detectDuplicates(
    organizationId: string,
    batchId?: string,
    useAi: boolean = true
  ): Promise<DuplicateDetectionResult> {
    const where: any = {
      organization_id: organizationId,
      deleted_at: null,
      status: { notIn: ['rejected', 'duplicate'] },
    };
    if (batchId) where.batch_id = batchId;

    const issues = await prisma.engineeringIssue.findMany({
      where,
      select: {
        id: true,
        issue_number: true,
        equipment_tag_raw: true,
        problem: true,
        asset_id: true,
        department: true,
      },
      orderBy: { equipment_tag_raw: 'asc' },
      take: 500,
    });

    const byMethod: Record<string, number> = {};
    let pairsDetected = 0;

    // Phase 1: Text-based duplicate detection (same tag, similar text)
    const tagGroups = new Map<string, typeof issues>();
    for (const issue of issues) {
      const tag = issue.equipment_tag_raw?.toUpperCase().trim();
      if (!tag) continue;
      if (!tagGroups.has(tag)) tagGroups.set(tag, []);
      tagGroups.get(tag)!.push(issue);
    }

    // Also group by asset_id
    const assetGroups = new Map<string, typeof issues>();
    for (const issue of issues) {
      if (!issue.asset_id) continue;
      if (!assetGroups.has(issue.asset_id)) assetGroups.set(issue.asset_id, []);
      assetGroups.get(issue.asset_id)!.push(issue);
    }

    // Merge groups
    const allGroups = [...tagGroups.values(), ...assetGroups.values()];

    for (const group of allGroups) {
      if (group.length < 2) continue;

      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];

          // Skip if already detected
          const exists = await prisma.issueDuplicate.findFirst({
            where: {
              OR: [
                { issue_a_id: a.id, issue_b_id: b.id },
                { issue_a_id: b.id, issue_b_id: a.id },
              ],
            },
          });
          if (exists) continue;

          // Text similarity
          const similarity = IssueDuplicateService.textSimilarity(a.problem, b.problem);

          if (similarity >= 0.6) {
            await prisma.issueDuplicate.create({
              data: {
                id: randomUUID(),
                organization_id: organizationId,
                issue_a_id: a.id,
                issue_b_id: b.id,
                similarity_score: similarity,
                similarity_method: 'text',
              },
            });
            pairsDetected++;
            byMethod['text'] = (byMethod['text'] || 0) + 1;
          }
        }
      }
    }

    // Phase 2: AI semantic duplicate detection (optional)
    if (useAi && pairsDetected === 0 && issues.length >= 2) {
      const aiPairs = await IssueDuplicateService.aiSemanticDetection(organizationId, issues);
      pairsDetected += aiPairs;
      if (aiPairs > 0) byMethod['ai_semantic'] = aiPairs;
    }

    return { pairs_detected: pairsDetected, pairs_by_method: byMethod };
  }

  /**
   * List unresolved duplicates.
   */
  static async listDuplicates(organizationId: string, resolved?: boolean) {
    const where: any = { organization_id: organizationId };
    if (resolved === false) where.resolution = null;
    if (resolved === true) where.resolution = { not: null };

    const items = await prisma.issueDuplicate.findMany({
      where,
      include: {
        issue_a: { select: { id: true, issue_number: true, problem: true, equipment_tag_raw: true, department: true, priority: true } },
        issue_b: { select: { id: true, issue_number: true, problem: true, equipment_tag_raw: true, department: true, priority: true } },
      },
      orderBy: { similarity_score: 'desc' },
      take: 200,
    });

    return items;
  }

  /**
   * Planner resolves a duplicate: merge_into_a, merge_into_b, keep_separate, rejected.
   */
  static async resolveDuplicate(
    organizationId: string,
    duplicateId: string,
    resolution: 'merge_into_a' | 'merge_into_b' | 'keep_separate' | 'rejected',
    userId: string,
    mergeNotes?: string
  ) {
    const dup = await prisma.issueDuplicate.findFirst({
      where: { id: duplicateId, organization_id: organizationId },
      include: {
        issue_a: { select: { id: true, problem: true, recommendation: true } },
        issue_b: { select: { id: true, problem: true, recommendation: true } },
      },
    });
    if (!dup) throw new Error('Duplicate not found');

    // Update resolution
    await prisma.issueDuplicate.update({
      where: { id: duplicateId },
      data: {
        resolution,
        resolved_by: userId,
        resolved_at: new Date(),
        ai_reasoning: mergeNotes
          ? `${dup.ai_reasoning || ''}\n\nPlanner note: ${mergeNotes}`
          : dup.ai_reasoning,
      },
    });

    // If merging, mark the "losing" issue as duplicate
    if (resolution === 'merge_into_a') {
      await prisma.engineeringIssue.update({
        where: { id: dup.issue_b.id },
        data: { status: 'duplicate', updated_by: userId },
      });
      // Append merged info to the winner
      if (dup.issue_b.recommendation) {
        await prisma.engineeringIssue.update({
          where: { id: dup.issue_a.id },
          data: {
            comments: `[Merged] ${dup.issue_b.problem}\n${dup.issue_b.recommendation || ''}`,
          },
        });
      }

      await prisma.issueAuditLog.create({
        data: {
          id: randomUUID(),
          issue_id: dup.issue_b.id,
          user_id: userId,
          action: 'merge',
          new_value: `Merged into ${dup.issue_a.id}`,
        },
      });
    } else if (resolution === 'merge_into_b') {
      await prisma.engineeringIssue.update({
        where: { id: dup.issue_a.id },
        data: { status: 'duplicate', updated_by: userId },
      });

      await prisma.issueAuditLog.create({
        data: {
          id: randomUUID(),
          issue_id: dup.issue_a.id,
          user_id: userId,
          action: 'merge',
          new_value: `Merged into ${dup.issue_b.id}`,
        },
      });
    }

    return { id: duplicateId, resolution };
  }

  // ── Private helpers ────────────────────────────────

  /**
   * Jaccard-based text similarity on word tokens.
   */
  private static textSimilarity(a: string, b: string): number {
    const tokenize = (s: string) => new Set(
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2) // skip trivial words
    );

    const setA = tokenize(a);
    const setB = tokenize(b);
    if (setA.size === 0 && setB.size === 0) return 0;

    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * AI-powered semantic duplicate detection for ambiguous pairs.
   */
  private static async aiSemanticDetection(
    organizationId: string,
    issues: Array<{ id: string; issue_number: string | null; equipment_tag_raw: string | null; problem: string }>
  ): Promise<number> {
    try {
      const provider = await loadProviderForJob(organizationId);
      const config: SyorityAiConfig = {
        provider: provider.provider,
        model: provider.model,
        apiKey: provider.apiKey,
        maxTokens: 4096,
        temperature: 0.1,
      };

      // Build pairs for AI (only issues sharing equipment tags)
      const pairs: Array<{ index: number; a: typeof issues[0]; b: typeof issues[0] }> = [];
      const tagMap = new Map<string, typeof issues>();
      for (const issue of issues) {
        const tag = issue.equipment_tag_raw?.toUpperCase().trim();
        if (!tag) continue;
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag)!.push(issue);
      }

      for (const group of tagMap.values()) {
        if (group.length < 2) continue;
        for (let i = 0; i < group.length && pairs.length < 20; i++) {
          for (let j = i + 1; j < group.length && pairs.length < 20; j++) {
            pairs.push({ index: pairs.length, a: group[i], b: group[j] });
          }
        }
      }

      if (pairs.length === 0) return 0;

      const pairsText = pairs.map((p) =>
        `Pair ${p.index}: [A] Tag: ${p.a.equipment_tag_raw}, Problem: "${p.a.problem}" | [B] Tag: ${p.b.equipment_tag_raw}, Problem: "${p.b.problem}"`
      ).join('\n');

      const prompt = `${DUPLICATE_DETECTION_PROMPT}\n\n--- ISSUE PAIRS ---\n${pairsText}`;
      const result = await callSyorityAI(config, prompt);
      const parsed = parseVisionJson<{ pairs: Array<{ pair_index: number; is_duplicate: boolean; confidence: number; reasoning: string }> }>(result.content);

      let created = 0;
      for (const aiResult of parsed.pairs || []) {
        if (!aiResult.is_duplicate || aiResult.confidence < 0.6) continue;
        const pair = pairs[aiResult.pair_index];
        if (!pair) continue;

        const exists = await prisma.issueDuplicate.findFirst({
          where: {
            OR: [
              { issue_a_id: pair.a.id, issue_b_id: pair.b.id },
              { issue_a_id: pair.b.id, issue_b_id: pair.a.id },
            ],
          },
        });
        if (exists) continue;

        await prisma.issueDuplicate.create({
          data: {
            id: randomUUID(),
            organization_id: organizationId,
            issue_a_id: pair.a.id,
            issue_b_id: pair.b.id,
            similarity_score: aiResult.confidence,
            similarity_method: 'ai_semantic',
            ai_reasoning: aiResult.reasoning,
          },
        });
        created++;
      }

      return created;
    } catch {
      // AI failure is non-fatal for duplicate detection
      return 0;
    }
  }
}
