# M6 Knowledge Engine — Verification Report

**Date:** 2026-07-26  
**Scope:** Platform Knowledge Engine (collect → analyze → review → approve)

## Architecture delivered

```
Platform
 └── Knowledge Engine
      ├── Incoming          (knowledge_assets.status = INCOMING)
      ├── AI Analysis       (AI_ANALYSIS)
      ├── Duplicate Detection (heuristic + optional AI)
      ├── Review Queue      (REVIEW_QUEUE)
      ├── Approved Library  (APPROVED → Standard Library)
      └── Rejected          (REJECTED)
```

## Schema

| Object | Purpose |
|--------|---------|
| `knowledge_assets` | Sanitized knowledge copies + pipeline metadata |
| `knowledge_review_logs` | Approve / Merge / Reject / Request revision audit |
| Enums | `KnowledgeAssetCategory`, `KnowledgeAssetStatus`, `KnowledgeReviewDecision` |

Migration: `prisma/migrations/20260726180000_knowledge_engine/migration.sql`

## Collection rules

**Collected (hooks):**

| Asset | Capture point |
|-------|----------------|
| Activity Codes | `ActivityLibraryService` create/update |
| UDF Definitions | `/api/settings/udf-definitions` POST/PUT |
| Workpack Templates | `WorkpackTemplateService` create/update |
| Equipment Types | `/api/admin/equipment-types` POST/PATCH |
| Resource Types | `/api/settings/master-data/resource-types` POST |
| Certificate Templates | settings certificate-templates POST/PATCH |
| Print Settings | `/api/settings/print-settings` POST |
| QA/QC & Safety Templates | `FormTemplateService` (form_type → category) |

**Never collected:** Workpacks, equipment tags, schedules, costs, contractors, documents, drawings, progress, personnel, shutdown reports (`FORBIDDEN_KNOWLEDGE_COLLECT`).

On tenant save: tenant write succeeds first → background sanitized copy → Redis job (failure does not block tenant).

## APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/api/platform/knowledge` | List + stats |
| GET | `/api/platform/knowledge/[id]` | Detail |
| POST | `/api/platform/knowledge/[id]/review` | Approve / Merge / Reject / Request revision |
| POST | `/api/platform/knowledge/analyze` | Re-queue / inline analysis |

## UI

| Route | Purpose |
|-------|---------|
| `/platform/knowledge` | Pipeline hub |
| `/platform/knowledge/review` | Review queue actions |
| `/platform/knowledge/[id]` | Detail + sanitized payload + decisions |

Nav: Platform → **Knowledge Engine** (`PLATFORM_NAV`).

## Background services

- Queue: `knowledge-engine` (`src/lib/queues.ts`)
- Worker: `src/workers/knowledgeEngineWorker.ts` (registered in `src/workers/index.ts`)

## Privacy / metadata

Sanitizer strips org/user/site IDs, emails, company/site names. Persists:

- Source Industry (from Organization.industry)
- Asset Category / Type
- Similarity Score
- First Seen / Last Seen / Times Used
- Opaque `source_org_hash` (not raw tenant id)

## Verification checklist

1. Apply migration: `npx prisma migrate deploy` (or `prisma db push` in local Docker).
2. Restart workers so `Knowledge Engine worker started` appears in logs.
3. As tenant: create/update an Activity Code (or Equipment Type).
4. Confirm row appears in `knowledge_assets` with `status` progressing to `REVIEW_QUEUE`.
5. Confirm sanitized payload has no `organization_id` / emails.
6. As platform admin: open `/platform/knowledge` → Review Queue → Approve.
7. Confirm asset status `APPROVED` and (for activity/equipment/resource/UDF) platform org master-data copy where applicable.
8. Confirm tenant save latency is unaffected when Redis is stopped (capture logs enqueue failure; tenant API still 2xx).

## Known gaps

- Dedicated Safety template model does not exist; Safety maps from `FormTemplate.form_type`.
- Workpack / Certificate / Print / Form template promotion to org tables is Approved-Library-first (shapes require `created_by` / unique constraints); activity, equipment, resource, UDF promote on Approve.
- AI enrichment uses heuristics by default; optional LLM when `KNOWLEDGE_ENGINE_AI_API_KEY` or `OPENAI_API_KEY` is set.
