/**
 * IssueMatchingService — Fuzzy-match imported equipment tags against Asset Register.
 * Exact (100%) → Normalized (95%) → Fuzzy/Levenshtein (80%) → Review Queue.
 * M7.2 — Engineering Scope Intelligence.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { IssueBatchService } from './IssueBatchService';

// ── Types ──────────────────────────────────────────

export type MatchResult = {
  issue_id: string;
  equipment_tag_raw: string;
  match_method: 'exact' | 'normalized' | 'fuzzy' | 'none';
  match_confidence: number;
  matched_asset_id: string | null;
  matched_tag: string | null;
  candidates: MatchCandidate[];
};

export type MatchCandidate = {
  asset_id: string;
  tag_number: string;
  name: string;
  confidence: number;
  method: string;
};

// ── Service ────────────────────────────────────────

export class IssueMatchingService {
  /**
   * Match a single issue against the Asset Register.
   */
  static async matchSingleIssue(
    organizationId: string,
    issueId: string,
    userId: string
  ): Promise<MatchResult> {
    const issue = await prisma.engineeringIssue.findFirst({
      where: { id: issueId, organization_id: organizationId, deleted_at: null },
    });
    if (!issue) throw new Error('Issue not found');
    if (!issue.equipment_tag_raw) {
      return {
        issue_id: issueId,
        equipment_tag_raw: '',
        match_method: 'none',
        match_confidence: 0,
        matched_asset_id: null,
        matched_tag: null,
        candidates: [],
      };
    }

    const result = await IssueMatchingService.findMatch(organizationId, issue.equipment_tag_raw);

    if (result.match_confidence >= 0.8 && result.matched_asset_id) {
      // Auto-link high-confidence matches
      await prisma.engineeringIssue.update({
        where: { id: issueId },
        data: {
          asset_id: result.matched_asset_id,
          match_confidence: result.match_confidence,
          match_method: result.match_method,
          status: 'matched',
          // Inherit hierarchy from asset
          plant_id: (await prisma.asset.findUnique({ where: { id: result.matched_asset_id }, select: { plant_id: true } }))?.plant_id || null,
          unit_id: (await prisma.asset.findUnique({ where: { id: result.matched_asset_id }, select: { unit_id: true } }))?.unit_id || null,
          system_id: (await prisma.asset.findUnique({ where: { id: result.matched_asset_id }, select: { system_id: true } }))?.system_id || null,
        },
      });

      await prisma.issueAuditLog.create({
        data: {
          id: randomUUID(),
          issue_id: issueId,
          user_id: userId,
          action: 'match',
          new_value: `${result.match_method} (${Math.round(result.match_confidence * 100)}%) → ${result.matched_tag}`,
        },
      });
    } else {
      // Below threshold — place into review queue
      await prisma.engineeringIssue.update({
        where: { id: issueId },
        data: {
          match_confidence: result.match_confidence,
          match_method: result.match_method === 'none' ? null : result.match_method,
          status: result.candidates.length > 0 ? 'pending_review' : 'unmatched',
        },
      });
    }

    return { issue_id: issueId, ...result };
  }

  /**
   * Batch match all unmatched issues in a batch or org.
   */
  static async matchBatch(
    organizationId: string,
    batchId: string | null,
    userId: string
  ) {
    const where: any = {
      organization_id: organizationId,
      deleted_at: null,
      asset_id: null,
      equipment_tag_raw: { not: null },
      status: { in: ['draft', 'pending_review', 'unmatched'] },
    };
    if (batchId) where.batch_id = batchId;

    const issues = await prisma.engineeringIssue.findMany({
      where,
      select: { id: true, equipment_tag_raw: true },
      take: 500, // process in chunks
    });

    let matched = 0;
    let unmatched = 0;
    let pending = 0;

    for (const issue of issues) {
      if (!issue.equipment_tag_raw) continue;

      const result = await IssueMatchingService.findMatch(organizationId, issue.equipment_tag_raw);

      if (result.match_confidence >= 0.8 && result.matched_asset_id) {
        const asset = await prisma.asset.findUnique({
          where: { id: result.matched_asset_id },
          select: { plant_id: true, unit_id: true, system_id: true },
        });

        await prisma.engineeringIssue.update({
          where: { id: issue.id },
          data: {
            asset_id: result.matched_asset_id,
            match_confidence: result.match_confidence,
            match_method: result.match_method,
            status: 'matched',
            plant_id: asset?.plant_id || null,
            unit_id: asset?.unit_id || null,
            system_id: asset?.system_id || null,
          },
        });
        matched++;
      } else if (result.candidates.length > 0) {
        await prisma.engineeringIssue.update({
          where: { id: issue.id },
          data: {
            match_confidence: result.match_confidence,
            match_method: result.match_method === 'none' ? null : result.match_method,
            status: 'pending_review',
          },
        });
        pending++;
      } else {
        await prisma.engineeringIssue.update({
          where: { id: issue.id },
          data: { status: 'unmatched', match_confidence: 0 },
        });
        unmatched++;
      }
    }

    // Update batch counters if applicable
    if (batchId) {
      await prisma.issueBatch.update({
        where: { id: batchId },
        data: { matched_count: matched, unmatched_count: unmatched + pending },
      });
    }

    return { processed: issues.length, matched, unmatched, pending_review: pending };
  }

  /**
   * Planner manually accepts a match.
   */
  static async acceptMatch(
    organizationId: string,
    issueId: string,
    assetId: string,
    userId: string
  ) {
    const issue = await prisma.engineeringIssue.findFirst({
      where: { id: issueId, organization_id: organizationId, deleted_at: null },
    });
    if (!issue) throw new Error('Issue not found');

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: organizationId },
      select: { id: true, tag_number: true, plant_id: true, unit_id: true, system_id: true },
    });
    if (!asset) throw new Error('Asset not found');

    await prisma.engineeringIssue.update({
      where: { id: issueId },
      data: {
        asset_id: assetId,
        match_confidence: 1.0,
        match_method: 'manual',
        status: 'matched',
        reviewed_by: userId,
        reviewed_at: new Date(),
        plant_id: asset.plant_id,
        unit_id: asset.unit_id,
        system_id: asset.system_id,
      },
    });

    await prisma.issueAuditLog.create({
      data: {
        id: randomUUID(),
        issue_id: issueId,
        user_id: userId,
        action: 'match',
        new_value: `Manual → ${asset.tag_number}`,
        notes: 'Planner accepted match',
      },
    });

    return { issue_id: issueId, asset_id: assetId, tag: asset.tag_number };
  }

  /**
   * Planner rejects a match and marks issue as unmatched.
   */
  static async rejectMatch(organizationId: string, issueId: string, userId: string) {
    await prisma.engineeringIssue.update({
      where: { id: issueId },
      data: {
        asset_id: null,
        match_confidence: null,
        match_method: null,
        status: 'unmatched',
        reviewed_by: userId,
        reviewed_at: new Date(),
      },
    });

    await prisma.issueAuditLog.create({
      data: {
        id: randomUUID(),
        issue_id: issueId,
        user_id: userId,
        action: 'unmatch',
        notes: 'Planner rejected match',
      },
    });

    return { issue_id: issueId, status: 'unmatched' };
  }

  /**
   * Create a placeholder asset for an unmatched tag.
   */
  static async createPlaceholder(
    organizationId: string,
    issueId: string,
    siteId: string,
    userId: string
  ) {
    const issue = await prisma.engineeringIssue.findFirst({
      where: { id: issueId, organization_id: organizationId, deleted_at: null },
    });
    if (!issue || !issue.equipment_tag_raw) throw new Error('Issue not found or no equipment tag');

    // Create a placeholder asset
    const asset = await prisma.asset.create({
      data: {
        organization_id: organizationId,
        site_id: siteId,
        tag_number: issue.equipment_tag_raw,
        name: issue.equipment_desc_raw || issue.equipment_tag_raw,
        description: `Placeholder created from issue ${issue.issue_number || issue.id}`,
        asset_type: 'placeholder',
        plant_id: issue.plant_id || null,
        unit_id: issue.unit_id || null,
        system_id: issue.system_id || null,
        created_by: userId,
      },
    });

    // Link issue to new asset
    await prisma.engineeringIssue.update({
      where: { id: issueId },
      data: {
        asset_id: asset.id,
        match_confidence: 1.0,
        match_method: 'placeholder',
        status: 'matched',
        reviewed_by: userId,
        reviewed_at: new Date(),
      },
    });

    await prisma.issueAuditLog.create({
      data: {
        id: randomUUID(),
        issue_id: issueId,
        user_id: userId,
        action: 'match',
        new_value: `Placeholder → ${issue.equipment_tag_raw}`,
        notes: 'Planner created placeholder asset',
      },
    });

    return { issue_id: issueId, asset_id: asset.id, tag: issue.equipment_tag_raw };
  }

  // ── Core matching logic ────────────────────────────

  private static async findMatch(
    organizationId: string,
    rawTag: string
  ): Promise<Omit<MatchResult, 'issue_id'>> {
    const trimmed = rawTag.trim();

    // 1. Exact match (100%)
    const exact = await prisma.asset.findFirst({
      where: { organization_id: organizationId, tag_number: trimmed },
      select: { id: true, tag_number: true, name: true },
    });
    if (exact) {
      return {
        equipment_tag_raw: trimmed,
        match_method: 'exact',
        match_confidence: 1.0,
        matched_asset_id: exact.id,
        matched_tag: exact.tag_number,
        candidates: [{ asset_id: exact.id, tag_number: exact.tag_number, name: exact.name, confidence: 1.0, method: 'exact' }],
      };
    }

    // 2. Normalized match (95%) — strip whitespace, case, separators
    const normalized = IssueMatchingService.normalizeTag(trimmed);
    const allAssets = await prisma.asset.findMany({
      where: { organization_id: organizationId },
      select: { id: true, tag_number: true, name: true },
    });

    const normalizedMatch = allAssets.find(
      (a) => IssueMatchingService.normalizeTag(a.tag_number) === normalized
    );
    if (normalizedMatch) {
      return {
        equipment_tag_raw: trimmed,
        match_method: 'normalized',
        match_confidence: 0.95,
        matched_asset_id: normalizedMatch.id,
        matched_tag: normalizedMatch.tag_number,
        candidates: [{
          asset_id: normalizedMatch.id,
          tag_number: normalizedMatch.tag_number,
          name: normalizedMatch.name,
          confidence: 0.95,
          method: 'normalized',
        }],
      };
    }

    // 3. Fuzzy match (80%) — Levenshtein ≤ 2 or prefix match
    const candidates: MatchCandidate[] = [];
    for (const asset of allAssets) {
      const assetNorm = IssueMatchingService.normalizeTag(asset.tag_number);
      const dist = IssueMatchingService.levenshtein(normalized, assetNorm);
      const maxLen = Math.max(normalized.length, assetNorm.length);
      const similarity = maxLen > 0 ? 1 - dist / maxLen : 0;

      if (dist <= 2 || normalized.startsWith(assetNorm) || assetNorm.startsWith(normalized)) {
        const confidence = dist <= 1 ? 0.85 : dist <= 2 ? 0.8 : 0.7;
        candidates.push({
          asset_id: asset.id,
          tag_number: asset.tag_number,
          name: asset.name,
          confidence: Math.max(confidence, similarity),
          method: 'fuzzy',
        });
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    const topCandidates = candidates.slice(0, 5);

    if (topCandidates.length > 0 && topCandidates[0].confidence >= 0.8) {
      return {
        equipment_tag_raw: trimmed,
        match_method: 'fuzzy',
        match_confidence: topCandidates[0].confidence,
        matched_asset_id: topCandidates[0].asset_id,
        matched_tag: topCandidates[0].tag_number,
        candidates: topCandidates,
      };
    }

    return {
      equipment_tag_raw: trimmed,
      match_method: 'none',
      match_confidence: 0,
      matched_asset_id: null,
      matched_tag: null,
      candidates: topCandidates,
    };
  }

  // ── String utilities ────────────────────────────

  private static normalizeTag(tag: string): string {
    return tag
      .toUpperCase()
      .replace(/[\s\-_\/\.]+/g, '')
      .replace(/^0+/, '')
      .trim();
  }

  private static levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }
}
