/**
 * Matches extracted fields to DB records.
 * Returns match candidates with confidence. Combined = (ai × 0.6) + (db × 0.4)
 *
 * @deprecated M16-R4 will replace this with M16EntityResolver + DimensionRegistry.
 * This module uses ad-hoc string matching without event scoping.
 */

import { prisma } from '@/lib/prisma';

export type MatchCandidate = {
  workpack_id: string;
  workpack_code: string;
  activity_id: string | null;
  activity_desc: string | null;
  db_confidence: number;
  match_reason: string;
};

export type MatchResult = {
  best_match: MatchCandidate | null;
  all_candidates: MatchCandidate[];
  db_confidence: number;
  unit_matched: boolean;
  asset_matched: boolean;
  activity_ambiguous: boolean;
};

const ACTIVE_WORKPACK_STATUSES = ['draft', 'under_review', 'approved', 'issued'] as const;

export async function matchToDatabase(
  organizationId: string,
  extracted: {
    unit_name: string | null;
    equipment_tag: string | null;
    job_description: string | null;
  },
  _requestingUserId: string | null
): Promise<MatchResult> {
  if (!extracted.equipment_tag) {
    return {
      best_match: null,
      all_candidates: [],
      db_confidence: 0,
      unit_matched: false,
      asset_matched: false,
      activity_ambiguous: false,
    };
  }

  const asset = await prisma.asset.findFirst({
    where: {
      organization_id: organizationId,
      tag_number: { equals: extracted.equipment_tag, mode: 'insensitive' },
      is_active: true,
    },
    include: {
      system: { select: { unit: { select: { id: true, name: true, code: true } } } },
    },
  });

  const assetMatched = !!asset;
  let unitMatched = false;
  const unit = asset?.system?.unit;

  if (asset && extracted.unit_name && unit) {
    const uName = extracted.unit_name.toLowerCase();
    const unitName = (unit.name ?? '').toLowerCase();
    const unitCode = (unit.code ?? '').toLowerCase();
    unitMatched =
      unitName.includes(uName) ||
      unitCode.includes(uName) ||
      uName.includes(unitCode);
  } else if (asset) {
    unitMatched = true;
  }

  if (!asset) {
    return {
      best_match: null,
      all_candidates: [],
      db_confidence: 0,
      unit_matched: false,
      asset_matched: false,
      activity_ambiguous: false,
    };
  }

  const workpacks = await prisma.workpack.findMany({
    where: {
      organization_id: organizationId,
      asset_id: asset.id,
      status: { in: [...ACTIVE_WORKPACK_STATUSES] },
      deleted_at: null,
    },
    include: {
      activities: {
        where: { deleted_at: null },
        select: {
          id: true,
          description: true,
          status: true,
        },
      },
    },
    take: 5,
  });

  if (workpacks.length === 0) {
    return {
      best_match: null,
      all_candidates: [],
      db_confidence: 0.3,
      unit_matched: unitMatched,
      asset_matched: true,
      activity_ambiguous: false,
    };
  }

  const candidates: MatchCandidate[] = [];
  type WpWithActs = (typeof workpacks)[number] & {
    activities: Array<{ id: string; description: string | null; status: string | null }>;
  };

  for (const wp of workpacks as WpWithActs[]) {
    for (const act of wp.activities) {
      let actScore = 0.5;
      if (extracted.job_description) {
        const jd = extracted.job_description.toLowerCase();
        const ad = (act.description ?? '').toLowerCase();
        const jdWords = jd.split(/\s+/).filter((w) => w.length > 3);
        const matches = jdWords.filter((w) => ad.includes(w)).length;
        const overlap = jdWords.length > 0 ? matches / jdWords.length : 0;
        actScore = 0.5 + overlap * 0.5;
      }
      if (!unitMatched) actScore *= 0.8;
      candidates.push({
        workpack_id: wp.id,
        workpack_code: wp.workpack_number ?? wp.id,
        activity_id: act.id,
        activity_desc: act.description ?? '',
        db_confidence: actScore,
        match_reason: `Tag ${asset.tag_number} → ${wp.workpack_number}`,
      });
    }
    if (wp.activities.length === 0) {
      candidates.push({
        workpack_id: wp.id,
        workpack_code: wp.workpack_number ?? wp.id,
        activity_id: null,
        activity_desc: null,
        db_confidence: 0.6,
        match_reason: `Tag ${asset.tag_number} → ${wp.workpack_number} (no activities)`,
      });
    }
  }

  candidates.sort((a, b) => b.db_confidence - a.db_confidence);
  const best = candidates[0] ?? null;
  const second = candidates[1];
  const ambiguous = !!(
    best &&
    second &&
    best.db_confidence - second.db_confidence < 0.1
  );

  return {
    best_match: best,
    all_candidates: candidates.slice(0, 5),
    db_confidence: best?.db_confidence ?? 0,
    unit_matched: unitMatched,
    asset_matched: assetMatched,
    activity_ambiguous: ambiguous,
  };
}
