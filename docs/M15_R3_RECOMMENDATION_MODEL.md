# M15-R3 — Recommendation Model

**Date:** 8 September 2026  
**Model:** `m15-recommendation-compose@1.0`

Recommendations are **assembled from deterministic facts**. They are not facts.

---

## Object

| Field | Rule |
|---|---|
| `recommendationId` | `m15-rec:{eventId}:{risk.id}` |
| `eventId` / `organizationId` | Copied from the risk (trusted scope) |
| `category` | SCHEDULE / RESOURCE / READINESS / CONSTRAINT / EXECUTION |
| `priority` | Copied from R2 management priority — **not** M13 P1–P4 restated as a new scale |
| `title` | Risk title |
| `problem` | Risk statement |
| `implication` | Template “why it matters” |
| `recommendation` | CONSIDER wording, or insufficient-evidence sentence |
| `rationale` | Names compose model + ranking score as intelligence |
| `evidence[]` | Copied from the risk; empty → `INSUFFICIENT_EVIDENCE` |
| `assumptions[]` | `does_not_execute`, `requires_m16_then_ews_for_execution` |
| `expectedConsequence` | Qualitative unless a later what-if is run |
| `consequenceType` | `QUALITATIVE` on composition |
| `estimatedImpact` | **Always null** on composition (no invented hours) |
| `affectedEntities` | From the risk |
| `sourceAuthorities` | Union of risk authorities + `M15` |
| `status` | `ADVISORY` \| `INSUFFICIENT_EVIDENCE` |
| `calculationType` | `RECOMMENDATION` |
| `modelVersion` | `m15-recommendation-compose@1.0` |

Categories not introduced: COST, SAFETY, MANPOWER, MATERIAL, MANAGEMENT, SCOPE. Those domains are either not separately modeled on R2 risks or would duplicate M12 blocker types already expressed as READINESS / CONSTRAINT.

---

## Templates (examples)

**Schedule (`CRITICAL_LATE` / `LATE` / `CRITICAL` / `PROGRESS_LAG` / `UPCOMING_RISK` / `LOW_FLOAT`)**  
Consider prioritising the workpack and resolving identified constraints before the next control point. Consequence is qualitative; no numeric slip reduction without M8.9.

**Readiness (`READINESS_BLOCKED`)**  
Consider assigning an owner and target date for the blocking item before release. Release may remain blocked until M12 is satisfied.

**Resource**  
Consider reallocating/augmenting the pool. Leveling is a what-if only.

**Constraint (`CONSTRAINT_BLOCKED`)**  
Consider resolving the open critical constraint before the next control point.

**On hold**  
Consider reviewing hold conditions. Explicitly **not** a RESUME instruction.

---

## Ranking

Unchanged from R2: `m15-management-priority@1.0`. LLM params cannot inject a score. Priority on the recommendation equals the risk’s management priority.

Cap: 50 recommendations, `recommendationsTruncated` when more exist.

---

## What this is not

- Not a BRE row
- Not an executable action
- Not a management decision record
- Not an M13 severity change
