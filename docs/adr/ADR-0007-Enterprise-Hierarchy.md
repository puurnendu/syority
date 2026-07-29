# ADR-0007: Enterprise Asset Hierarchy

**Status:** Accepted  
**Date:** 2026-07-28  
**Decision makers:** Platform Architecture Team  
**Milestone:** M6.7 — Enterprise Hierarchy Stabilization

---

## Context

Aurianoa OS (AOS STO) is a shutdown / turnaround management platform that manages industrial assets across multiple physical locations. Every module — Planning, Execution, Master Data, Workpacks, Templates, Knowledge Engine, Import/Export, Reporting, and future AI modules — must reference assets within a consistent organizational hierarchy.

Prior to M6.7, each module implemented its own partial hierarchy logic (inline cascading selectors, direct Prisma queries, hardcoded parent chains). This led to inconsistencies, duplicated code, and the inability to add new hierarchy levels (e.g., Area) without modifying every consumer.

---

## Decision

### 1. Single Standard Hierarchy

```
Platform
    └─ Company (Organization / Tenant)
         └─ Site
              └─ Plant
                   └─ Area (optional, per-tenant toggle)
                        └─ Unit
                             └─ System
                                  └─ Asset (Equipment)
                                       └─ Workpack
                                            └─ Activity
```

**Why this hierarchy:**
- Reflects the physical structure of industrial plants (refineries, petrochemical, power generation)
- Site → Plant separation enables multi-plant sites (e.g., a refinery complex with CDU, FCC, Utilities)
- Area is optional because not all industries use this intermediate level
- Unit → System → Asset mirrors how maintenance operations are organized
- Workpack → Activity represents the execution hierarchy within a shutdown event

### 2. UUIDs Never Appear in UI

All entity references use UUIDs internally for performance, security, and referential integrity. However, users never see or type UUIDs. Instead:
- Dropdowns show `"name (code)"` format
- Imports use human-readable names/codes with backend resolution
- Breadcrumbs show human-readable names

**Why:** UUIDs are meaningless to operations engineers. Exposing them creates data entry errors and security risks (information leakage about internal record structure).

### 3. Imports Use Names, Never IDs

The import engine accepts columns like `Site`, `Plant`, `Unit` — not `site_id`. Resolution from name/code to UUID is handled by `HierarchyService.resolveNamesToIds()`.

**Why:** Excel/CSV imports are created by non-technical users. They know "Bathinda" and "CDU", not UUIDs. Name resolution also enables cross-tenant template sharing without exposing internal IDs.

### 4. Area Is Optional (Per-Tenant)

The Area level is toggled via `Organization.feature_flags.use_areas`. When disabled:
- `HierarchySelector` skips the Area dropdown
- Breadcrumbs omit Area
- Units are created directly under Plant (not Area)

**Why:** Oil & Gas and Power Generation heavily use Areas (e.g., "Offsites", "Tank Farm"). But lighter industries (pharmaceutical, food processing) typically don't need this level. Forcing it on all tenants would add unnecessary complexity.

### 5. Selectors Are Lazy-Loaded

`HierarchySelector` fetches each level independently via `/api/hierarchy/children?level=X&parentId=Y`, not the full tree.

**Why:** In large organizations, a site may have 20+ plants, 100+ units, and 1000+ systems. Loading the full tree eagerly causes:
- Slow initial page loads
- Excessive memory consumption
- Poor UX (long loading spinners)

### 6. Hierarchy Remains Normalized

Asset stores only `site_id` + `system_id`. The full path (Plant, Area, Unit) is derived at runtime through the relationship chain: `Asset → System → Unit → Area? → Plant → Site`.

**Why:**
- Denormalization creates update anomalies (rename a Unit → must update every Asset)
- The normalized form is the correct relational design
- HierarchyService provides efficient path resolution

**Exception:** Workpack stores denormalized `plant_id`, `unit_id`, `system_id`, `asset_id` because workpacks are the primary operational query entity and need fast multi-level filtering without joins.

### 7. One HierarchyService, One HierarchySelector

All hierarchy operations go through `HierarchyService` (backend) and `HierarchySelector` (frontend). No module may implement its own hierarchy logic.

**Why:** Before M6.7, 4+ pages had duplicated cascading fetch chains. Each had subtle differences (some included Area, some didn't; some used `/api/settings/sites`, some used `/api/hierarchy/sites`). Centralizing eliminates these inconsistencies.

---

## Consequences

### Positive
- Single source of truth for hierarchy across all modules
- Adding a new hierarchy level requires changing only HierarchyService + HierarchySelector
- Area toggle works consistently everywhere
- Knowledge Engine can scope AI recommendations by hierarchy location
- Import engine works with human-readable names

### Negative
- All forms must use `HierarchySelector` — no custom one-off selectors
- Path resolution requires multiple DB queries (mitigated by caching at API level)
- Existing pages had to be refactored (one-time cost)

---

## References

- [M6_6_HIERARCHY_AUDIT.md](../M6_6_HIERARCHY_AUDIT.md)
- [M6_7_IMPLEMENTATION_PLAN.md](../M6_7_IMPLEMENTATION_PLAN.md)
- [HierarchyService.ts](../../src/core/hierarchy/HierarchyService.ts)
- [HierarchySelector.tsx](../../src/components/hierarchy/HierarchySelector.tsx)
- [HierarchyBreadcrumbs.tsx](../../src/components/hierarchy/HierarchyBreadcrumbs.tsx)
