# M6 Design — Standard Workpack Template

Interactive review: open the Cursor canvas `m6-standard-workpack-template-design.canvas.tsx`.

## Verdict

Today’s template is an **activity list with a thin header**. Target is a **9-section reusable methodology** that can be instantiated into a workpack without mutating the original, and that participates in Platform / Tenant / Incoming Knowledge libraries.

## Current vs target

| Area | Today | Target |
|------|-------|--------|
| Shape | `workpack_templates` + activities (+ partial checklists) | 9 sections with relational children |
| Create path | Apply = merge activities into **existing** workpack | **Instantiate** = create workpack from revision |
| Versioning | None (`is_system` / `is_active` only) | `template_family_id` + immutable `revision` |
| Libraries | Inferred via `organization_id` + `is_system` | Platform Standard / Tenant / Incoming KE |
| KE promote | Capture yes; materialize no-op | Approve/Merge → Platform family revision |

## Database (summary)

- Evolve header: family, revision, status, library_scope, category, equipment_class, discipline, AI fields, metrics.
- Add child tables for resources, materials, safety, QA/QC, references, logic links.
- Published revisions immutable; instantiate copies revision → instance tables only.

## APIs (summary)

Unify on `/api/templates` (+ clone, version, compare, instantiate, deprecate). Keep `/apply` as merge-only. KE review promotes to Platform Standard.

## Versioning

Draft → Publish (freeze) → Edit creates revision+1 → Deprecate blocks instantiate. Human `version_label` optional; system truth is integer `revision`.

## Knowledge Engine

Capture on **publish** of tenant templates (sanitized). Approve/Merge materializes Platform Standard. Never collect workpack operational data.

## Delivery phases

P0 base/versioning → P1 General+Planning+instantiate → P2 Resources–QA → P3 References+AI+compare → P4 metrics+KE promote loop.

See canvas for full section gap table, instantiation steps, compare rules, and API matrix.
