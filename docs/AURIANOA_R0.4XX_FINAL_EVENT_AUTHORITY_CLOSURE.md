# AURIANOA R0.4 — FINAL EVENT AUTHORITY CLOSURE

**Phase:** R0.4-XX (final closure of R0.4-B/C/D/E)
**Scope:** Event-only STO operational container boundary
**Date:** 2026-09-09
**Governing principle:** ENTER ONCE → STORE ONCE → DERIVE ONCE → REUSE EVERYWHERE
**FINAL DECISION:** **AMBER** — R1 remains BLOCKED

---

## 1. Executive Summary

R0.4 source implementation is now complete and, on static evidence, the Event-only
operational boundary holds. This phase did **not** merely re-inspect R0.4-E: the
Phase A forensic audit uncovered **two previously undetected authority defects**
that R0.4-E had missed, both of which are Critical-Stop-Condition class. Both were
remediated in this phase.

| New defect | Description | Class | Status |
|---|---|---|---|
| **R04-P1-006** | `GET /api/projects/{id}/s-curve` was a **complete second EVM engine** — it computed the full earned-value set from raw Prisma, scoped by `workpack.project_id` and windowed by Project planned shutdown/startup dates. Violated frozen decision #22 and made a Project identifier an STO performance-measurement authority. | P1 | **FIXED** |
| **R04-P1-007** | `/projects/{id}/ta-dashboard` used its own `/projects/[id]` URL segment **as an Event key** against Event progress/constraint/punch/lookahead/safety APIs ("same ID can be event"). A Project identifier could therefore establish Event identity. | P1 | **FIXED** |

The four R0.4-D leftovers (R04-P1-001/002/004/005) are confirmed closed in source.

**Why this is AMBER, not GREEN:** the agent shell in this environment is
non-functional — it will not execute even a shell builtin (`echo`) or `node -v`,
with three separate probes stalling past 45s, 90s and 280s respectively. Therefore
Phase M (targeted tests), Phase N (regression), Phase O (browser) and Phase Q
(live database census) **were not executed**. Per the Final Decision Rule
(§27 of the mission brief) and Phase O, absent test/browser infrastructure the
status is AMBER. No GREEN has been manufactured from source inspection.

---

## 2. Scope

**In scope:** Completion and verification of the Event-only STO operational
container boundary — Event authority, CPM, S-curve/EVM, M16 navigation, Workpack
creation, Activity identity, tenant isolation, deprecated Project surfaces,
architectural guard.

**Explicitly out of scope:** R1 Time & Planning Propagation. No R1 code was
written. See §27.

---

## 3. Frozen Architecture

All 26 frozen decisions from the mission brief were treated as immutable. None
were reopened. Of particular relevance to the defects found:

- **#22 — No second EVM/S-curve engine.** Violated by R04-P1-006; now restored.
- **#6/#7 — No Project→Event and no Event→Project inference.** R04-P1-007 was a
  latent violation by identifier conflation rather than by an explicit resolver.
- **#14 — M8.10 remains EVM/S-curve authority.** Now singular.
- **#12 — M11 remains CPM authority.** Confirmed singular.
- **#19 — ActivityCreationCommand remains the Activity creation boundary.** Confirmed.

Legitimate non-STO Project concepts remain intact and were **not** touched:
`DigitalPlantProject`, P6/MS Project interchange, `work_type = Project`.

---

## 4. R0.4-B Decision

Event is the sole STO operational campaign container; Project is not. Recorded in
`docs/AURIANOA_R0.4B_EVENT_AUTHORITY_DECISION.md`. That document already declared
`resolveEventIdFromProject` "forbidden as architecture" (first-hit, not 1:1) and
deferred its removal to implementation. That removal is now complete (§10).

---

## 5. R0.4-C Classification

Project↔Event relationship classified as non-authoritative for STO operations.
Recorded in `docs/AURIANOA_R0.4_PROJECT_EVENT_CONSOLIDATION_FORENSIC_AUDIT.md`.

---

## 6. R0.4-D Review Workflow

Human Workpack Identity Review remains the sole authority for disposing of
Event-less Workpacks. Verified in this phase — see §14 and §19.

---

## 7. R0.4-E Implementation

Confirmed closed in source:

| ID | Item | Evidence |
|---|---|---|
| R04-P1-001 | Project-based CPM enqueue removed; Event-authoritative enqueue added | `src/core/schedule/enqueueEventScheduleRecalculate.ts:22-62`; `src/modules/Activity/Services/ActivityService.ts:4,14-25` |
| R04-P1-002 | `resolveEventIdFromProject` deleted | Repo-wide grep: zero production hits (§10) |
| R04-P1-004 | Control Tower S-curve on M8.10 Event EVM endpoint | `src/components/Schedule/SCurveChart.tsx:24,26`; `src/components/m13/ControlTowerDashboard.tsx:8,177` |
| R04-P1-005 | M16 STO campaign navigation on Event routes | `src/core/m16/navigation/NavigationRegistry.ts:69-107` |
| — | New STO Workpacks require Event context | `src/modules/Workpack/Services/WorkpackService.ts:65-85` |
| — | 177 Event-less Workpacks not auto-assigned | `src/core/workpack-identity-review/WorkpackIdentityReviewService.ts:346-351` |

---

## 8. Remaining Project Reference Audit (Phase A)

Read-only audit performed with repository-wide search over `project_id`,
`projectId`, `legacyProjectId`, `Project`, `resolveEventIdFromProject`,
`/projects/`, `api/projects`. No bulk string replacement was performed. Every
disposition below was decided per occurrence.

### Classification summary

| Class | Meaning | Representative locations | Disposition |
|---|---|---|---|
| **A** | Legitimate external P6/MS Project interchange | `src/modules/Scheduling/parsers/P6XmlParser.ts`, `P6XerParser.ts`, `MsProjectXmlParser.ts`, `app/api/projects/[id]/imported-schedule/route.ts`, `schedule/export/xer/route.ts` | **RETAIN** |
| **B** | Legitimate DigitalPlantProject | `src/core/digital-plant/*` (`DigitalPlantService`, `PlantImportService`, `ExtractionService`, `PlantDocumentService`, `ReviewService`), `app/api/digital-plant/**`, `app/(dashboard)/digital-plant/[projectId]/page.tsx` | **RETAIN** |
| **C** | Legitimate `work_type = Project` classification | `src/components/Workpack/WorkpackCreateForm.tsx` | **RETAIN** |
| **D** | Deprecated STO Project operational dependency | See table below | **ISOLATE / DEPRECATE** |
| **E** | Dead / misleading / ambiguous leftover | See table below | **REMOVE / DOCUMENT** |

### Class D / E detail

| # | File | Function / route | Reachable | Primary nav | M16 | CPM | S-curve | Event identity | Tenant security | Class | Disposition |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `app/api/projects/[id]/s-curve/route.ts` | `GET` — full second EVM engine | Yes (legacy pages) | No | No | No | **YES** | **YES** (Project dates defined the campaign window) | No (org-scoped) | D | **FIXED — retired, fails closed** (§11) |
| 2 | `app/(dashboard)/projects/[id]/ta-dashboard/page.tsx` | TA dashboard client | Yes (Project detail tab) | No | Previously yes | No | Yes (via #1) | **YES** (`projectId` used as Event key) | Ambiguous | D | **FIXED — retired surface** (§18) |
| 3 | `app/api/projects/[id]/schedule/route.ts` | `POST` | Yes | No | No | No (retired) | No | No | No | D | **DEPRECATE** — 409 `EVENT_REQUIRED` (`:132-147`) |
| 4 | `app/api/projects/[id]/schedule/route.ts` | `GET` | Yes | No | No | No | No | No | Org-scoped | D | **ISOLATE** — read-only Project display; no CPM, no identity |
| 5 | `app/api/projects/[id]/lookahead/route.ts` | `GET` | Yes | No | No | No | No | No | No | D | **DEPRECATE** — `PROJECT_LOOKAHEAD_RETIRED` (`:14-21`) |
| 6 | `src/components/Dashboard/SCurveChart.tsx` | `SCurveChart({ projectId })` | Yes | No | No | No | Consumer only | No | No | D | **ISOLATE** — now renders empty state (#1 retired) |
| 7 | `src/components/Schedule/ScheduleContainer.tsx:1924-1926` | `ProjectSCurveChart` | Only `/projects/{id}/schedule` | No | No | No | Consumer only | No | No | D | **ISOLATE** — guarded by `projectId`; canonical `/schedule` passes none (`:341`, `app/(dashboard)/schedule/page.tsx:42`) |
| 8 | `app/(dashboard)/projects/[id]/ProjectDetailClient.tsx` | Legacy Project detail | Yes | No (nav item removed) | No | No | Consumer only | No | Org-scoped | D | **ISOLATE** — legacy display page |
| 9 | Other `app/api/projects/[id]/*` (`punch`, `constraints`, `wbs`, `baselines`, `safety`, `reports/daily`, `resource-histogram`, `activities/unit-progress`, `schedule/metrics`, `ai-assistant`) | Various | Yes | No | No | No | No | No | Org-scoped | D | **ISOLATE** — legacy Project-scoped surfaces; no CPM/EVM/identity authority |
| 10 | `src/core/m16/navigation/NavigationRegistry.ts:32` | `RouteParams.projectId` | n/a | No | Unused | No | No | No | No | E | **DOCUMENT** — proven unused for campaign identity; guard-asserted (§23) |
| 11 | `src/core/m16/pipeline/M16InteractionPipeline.ts` | `PipelineInput.projectId` | n/a | No | Unused | No | No | No | No | E | **DOCUMENT** — optional legacy field, not used for navigation |
| 12 | `app/(dashboard)/projects/[id]/ta-dashboard` `/api/events/${projectId}/{punch,lookahead,constraints,activities/unit-progress}` | Fallback fetches | Was reachable | No | No | No | No | **YES** | Ambiguous | E | **FIXED** — routes never existed (dead 404s); removed with #2 |

**Note on #12:** these fallbacks targeted Event endpoints that do not exist
(`app/api/events/**` contains no `punch`, `lookahead`, `constraints` or
`activities/unit-progress` route). They were simultaneously dead *and* identity-
conflating.

---

## 9. Event Authority Verification (Phase B)

| Invariant | Result | Evidence |
|---|---|---|
| Event context is authenticated / session-bound | **PASS** | `withTenantGuard` + `session.user.organization_id` on all Event routes, e.g. `app/api/events/[eventId]/schedule/evm/s-curve/route.ts:18-23` |
| Event belongs to session organization | **PASS** | `prisma.event.findFirst({ id, organization_id: orgId, deleted_at: null })` — s-curve route `:26-29`, enqueue adapter `:45-48`, Workpack create `:72` |
| Cross-tenant Event access fails closed | **PASS (static)** | Generic `{ error: 'Not found' }` 404 (`:30-32`); `notFound()` on `app/(dashboard)/events/[eventId]/ta-dashboard/page.tsx:21` |
| Event-less new STO Workpack creation fails | **PASS** | `WorkpackIdentityError('EVENT_REQUIRED')` — `WorkpackService.ts:65-71` |
| Event-less Workpack does not guess an Event | **PASS** | `enqueueEventScheduleRecalculate` returns `EVENT_REQUIRED`, never selects an Event — `:41-43` |
| Event-less Activity does not guess an Event | **PASS** | `ActivityService.enqueueRecalculate` defers on non-enqueue — `:24-25` |
| No Project ID can establish Event identity | **PASS (after fix)** | R04-P1-007 was the sole remaining violation; guard now scans for it (§23) |
| UUID possession is not authorization | **PASS** | Every Event lookup is `organization_id`-scoped; no bare `findUnique({ id })` on Event in STO paths |

---

## 10. CPM Verification (Phase C)

M11 is the sole CPM authority. Verified path:

```
Activity mutation (create/update/delete/approveForScheduling)
  → ActivityService.enqueueRecalculate(orgId, event_id, workpack_id)   [:114,145,166,213]
  → enqueueEventScheduleRecalculate({ organizationId, eventId, workpackId })
  → org-scoped Workpack → event_id  [:30-39]
  → org-scoped Event existence check [:45-51]
  → scheduleRecalculateQueue.add('recalculate', { eventId, orgId }) [:53-60]
  → scheduleRecalculateWorker requires eventId + orgId [:31-33]
  → ScheduleOrchestrationService.calculateEventSchedule(eventId, orgId) [:37]
  → M11 persisted CPM outputs
```

| Case | Required | Result | Evidence |
|---|---|---|---|
| 1 — Event-linked Workpack | Queue + calculate Event A; never reference Project | **PASS (static)** | `jobId: recalc-${eventId}`; adapter contains no `project_id` |
| 2 — Event-less Workpack | No enqueue; `EVENT_REQUIRED`; no guess | **PASS (static)** | `:41-43` |
| 3 — Cross-tenant Event | Reject; no queue; no CPM | **PASS (static)** | `:45-51` → `CROSS_TENANT_EVENT` |
| 4 — Event A vs Event B | Independent schedules | **PASS (static)** | Job key and orchestration are `eventId`-scoped |
| 5 — Project schedule POST | Must not calculate CPM; documented deprecation | **PASS** | 409 `EVENT_REQUIRED`, `app/api/projects/[id]/schedule/route.ts:132-147` |
| 6 — Legacy Project schedule route | No secret Project→Event resolution | **PASS** | Route imports no orchestration service |
| — | `resolveEventIdFromProject` absent from production | **PASS** | Repo-wide grep: hits only in `docs/**` and in tests asserting **absence** (`ScheduleOrchestrationService.test.ts:220-221`, `r04e-event-cpm-enqueue.test.ts:80-81`, `tests/m11-v1-schedule-view.test.ts:101`) |

**Single enqueue chokepoint:** `scheduleRecalculateQueue.add` appears in exactly
one production file — the Event adapter itself. Guard-asserted (§23).

**No second CPM engine:** no alternate CPM implementation found.

---

## 11. S-Curve / EVM Verification (Phase D)

**This phase restored EVM singularity.** Before the fix there were **two**
engines. `app/api/projects/[id]/s-curve/route.ts` independently computed weekly
BCWS/BCWP/ACWP buckets and the full scalar set (SPI, CPI, SV, CV, EAC, ETC, VAC,
BAC) over `workpack: { project_id }`, using `Project.plannedSdDate` /
`plannedSuDate` as the campaign window, plus a `ScheduleBaseline` lookup keyed on
`project_id`. It also emitted the 422 `"Project is missing planned start/finish
dates"` that Phase O explicitly forbids.

**Remediation:** the route now fails closed — no earned-value arithmetic, no
Prisma access, no Project date window. It returns
`code: 'PROJECT_S_CURVE_RETIRED'` with empty `sCurve`/`series` and `evm: null`, so
legacy display surfaces render their documented empty state rather than an error
banner. (`app/api/projects/[id]/s-curve/route.ts`)

Sole remaining authority: **M8.10** `generateEventCurve` / `calculateLiveEvm`.

| Case | Required | Result | Evidence |
|---|---|---|---|
| Event A | M8.10 Event A curve | **PASS (static)** | `app/api/events/[eventId]/schedule/evm/s-curve/route.ts:40` |
| Event B | M8.10 Event B curve | **PASS (static)** | Same route, `eventId`-scoped |
| No data | 200 + documented empty state | **PASS** | `:42-48` → `data: null`, `"No schedule/progress data available"` |
| Cross-tenant Event | 404 not found | **PASS** | `:26-32` generic `Not found` |
| Project | Never required for Event S-curve | **PASS** | Route takes only `eventId` + session org |

**Control Tower calculates nothing.** `src/components/m13/ControlTowerDashboard.tsx:177`
renders `<SCurveChart eventId={eventId} />`; `src/components/Schedule/SCurveChart.tsx:26`
fetches the Event EVM endpoint. The mapper `src/core/evm/mapEventCurveToChart.ts`
is presentation-only — it reshapes curve/summary data and selects the empty-state
message. No PV/EV/AC/EAC/SPI/CPI is derived there.

Legitimate Event EVM consumer confirmed: `src/components/planner-workspace/evm/CostControlDashboard.tsx:121`
uses `/api/events/${selectedEventId}/schedule/evm/*`.

---

## 12. M16 Verification (Phase E)

M16 uses trusted Event context. `NavigationRegistry` emits no `/projects/` path
for any target.

| Target | Path | Page exists |
|---|---|---|
| `control_tower` | `/events/${eventId}/control-tower` | ✅ `app/(dashboard)/events/[eventId]/control-tower/page.tsx` |
| `dashboard` | `/events/${eventId}/ta-dashboard` | ✅ `app/(dashboard)/events/[eventId]/ta-dashboard/page.tsx` |
| `execution` | `/events/${eventId}/execution-readiness` | ✅ `app/(dashboard)/events/[eventId]/execution-readiness/page.tsx` |
| `reports` | `/events/${eventId}/management-intelligence` | ✅ `app/(dashboard)/events/[eventId]/management-intelligence/page.tsx` |
| `constraints` | `/events/${eventId}/materials` | ✅ `app/(dashboard)/events/[eventId]/materials/page.tsx` |
| `workpack` / `activity` | `/workpacks/{id}` | ✅ canonical entity route |
| `equipment` | `/asset-register/{assetId}` | ✅ canonical entity route |
| `schedule` | `/schedule` | ✅ |

No duplicate routes were invented. Channel adapters (`WhatsAppChannelAdapter`,
`VoiceChannelAdapter`) resolve through the same pipeline and registry, so Web,
WhatsApp, Voice and Mobile share one Event-context resolution path.

`PipelineInput.projectId` and `RouteParams.projectId` remain as optional legacy
fields, proven unused for campaign identity/navigation and documented as such in
source (`NavigationRegistry.ts:31-32`).

---

## 13. Workpack Boundary (Phase G)

Every production STO Workpack creation path converges on
`WorkpackService.createWorkpack`, which requires Event context:

- `EVENT_REQUIRED` if `event_id` missing/unnormalizable (`:65-71`)
- Event must exist for the session organization (`:72`)
- `CROSS_TENANT_EVENT` when the Event exists in another tenant, `INVALID_EVENT`
  otherwise — both surfaced as generic *Event not found* (`:78-85`)

| Path | Converges | Evidence |
|---|---|---|
| `POST /api/workpacks` | ✅ | `app/api/workpacks/route.ts:98` (+ `isWorkpackIdentityError` handling) |
| Workpack UI | ✅ | `WorkpackCreateForm.tsx` requires `Event *`; posts to the route above |
| AI-generated Workpack | ✅ | `app/api/workpacks/ai-generate/route.ts:132`, with explicit `EVENT_REQUIRED` pre-check |
| `TemplateLibraryService.instantiate` | ✅ | `src/core/planning/TemplateLibraryService.ts:561`, `opts.event_id` required |
| Server action | ✅ | `src/modules/Workpack/Actions/workpack.actions.ts:9` |
| Workpack Factory | ✅ | `app/(dashboard)/workpack-factory/page.tsx:243` calls the API path, not Prisma |
| Scope-change `new_workpack` | ✅ | No direct `prisma.workpack.create`; routed through the service |

No path infers Event from Project, first Event, Plant, date, or UUID.

**One documented non-STO exception (P2):** `src/core/Platform/SeedPackService.ts:797-800`
uses `prisma.workpack.create` directly with `event_id: event?.id`, where the Event
is resolved from an explicit seed-pack config code. If a seed pack declares no
`shutdownEvent`, it can create an Event-less Workpack. This is an
administrative seeding/demo installer, not an operational STO creation path, and
it performs **no** Project→Event inference. Any such row lands in the same human
Workpack Identity Review queue as the existing 177. Classified **P2** — see §24.

---

## 14. Activity Boundary (Phase H)

`ActivityCreationCommand` remains authoritative (`src/core/activity/ActivityCreationCommand.ts`);
`ActivityService.createActivity` delegates to it (`:7`, `:108-114`).
`Activity.event_id` is retained as a denormalized operational identity field.

The `Activity.event_id == Workpack.event_id` invariant is actively surfaced:
`WorkpackIdentityReviewService` computes child mismatches
(`:694-702` — filters activities whose `event_id !== workpackEventId`) and blocks
assignment for `CONFLICTING_CHILD_EVENT` (`:262` `assign_blocked`).

No `Activity.asset_id` was introduced. Equipment remains `Workpack.asset_id`-based.

---

## 15. Tenant Isolation (Phase K — static)

Verified at the **service layer**, not only route guards:

| Case | Expected | Enforcement point |
|---|---|---|
| Tenant A + Event A | Allowed | `organization_id`-scoped `findFirst` |
| Tenant A + Event B | Denied | `enqueueEventScheduleRecalculate:45-51`; s-curve route `:26-32` |
| Tenant B + Workpack A | Denied | `enqueueEventScheduleRecalculate:31-37` (`NO_WORKPACK`) |
| Tenant B + Activity A | Denied | `ActivityService` queries are `organization_id`-scoped |
| Legacy Project UUID | Establishes no STO authority | All Project→STO authority paths retired (§8, §10, §11) |

Existence leakage is avoided via generic responses (`Not found`, *Event not found*).

**Not behaviourally executed** — see §20.

---

## 16. Security

- No AI path writes Prisma directly; M16 adapters are guard-asserted against
  `prisma.workpack.create` (`m16-r4-whatsapp.test.ts:406`, `m16-r3-execution.test.ts:460,507`).
- Project is no longer used as a security boundary anywhere in the STO path. The
  Project id was removed from the activity-update `where` clause in R0.4-E
  (`app/api/projects/[id]/schedule/activities/[activityId]/route.ts`).
- Cross-tenant Workpack creation returns a generic *Event not found*.

---

## 17. API Audit (Phase P)

| Route | Status | Notes |
|---|---|---|
| `POST /api/schedule/calculate` | **RETAIN** (canonical) | Event-authoritative CPM entry |
| `GET /api/events/{eventId}/schedule/evm/s-curve` | **RETAIN** (canonical) | M8.10; org-scoped; documented empty state |
| `GET /api/events/{eventId}/schedule/evm/summary` | **RETAIN** (canonical) | M8.10 |
| `POST /api/workpacks` | **RETAIN** (canonical) | Event required |
| `POST /api/projects/{id}/schedule` | **DEPRECATE** | 409 `EVENT_REQUIRED`; no CPM |
| `GET /api/projects/{id}/schedule` | **ISOLATE** | Read-only legacy display; no CPM/identity |
| `GET /api/projects/{id}/lookahead` | **DEPRECATE** | `PROJECT_LOOKAHEAD_RETIRED`; empty list |
| `GET /api/projects/{id}/s-curve` | **DEPRECATE** (this phase) | `PROJECT_S_CURVE_RETIRED`; no EVM math |
| `app/api/digital-plant/**` | **LEGITIMATE NON-STO** | DigitalPlantProject |
| `GET /api/projects/{id}/imported-schedule`, `schedule/export/xer` | **LEGITIMATE NON-STO** | P6/MS Project interchange |

None of the deprecated routes can act as a hidden alternate STO authority: each
either fails closed or performs a read-only Project-scoped display with no CPM,
no EVM, and no Event identity establishment.

---

## 18. Navigation Audit (Phase F, S)

- **One active STO campaign context.** No second Event cookie, resolver, or
  campaign selector was created. No Project-based fallback context exists.
- `src/components/NavBar.tsx` — the `projectId`-aware `rewriteItems` rewriting was
  removed in R0.4-E.
- `app/(dashboard)/layout.tsx` — the `Projects` nav item was removed from
  `planningItems`, so no primary navigation entry point leads into Project STO
  surfaces.
- **Route integrity (Phase S): PASS.** All five M16-generated Event routes resolve
  to real pages (§12). No migrated navigation points at a 404, dead route, or
  placeholder.
- **Retired surface (this phase):** `/projects/{id}/ta-dashboard` was a 1,300-line
  duplicate of the canonical Event TA dashboard that derived Event identity from
  the Project URL segment. It is replaced by a controlled retired state that
  performs **no** identifier interpretation and routes operators to `/events`. It
  is never a 404 dead end, satisfying the Phase S "no beautiful UI → 404" rule.
  The single inbound link (`ProjectDetailClient.tsx:85`) now lands on that
  explanatory state.

---

## 19. Data Census (Phase Q)

**NOT RUN.** No database access was possible — the shell would not execute.

Prior recorded figures from R0.4-D (**not re-verified in this phase**):
- Event-less Workpacks: **177**
- These remain the responsibility of the human review workflow.

No production data was modified in this phase. Existing unresolved data remains
unresolved pending human disposition, as required.

Required census fields still outstanding: Workpacks total / Event-linked /
Event-less / Project-linked, Activities total / with Event / without Event,
Activity↔Event contradictions, Activity↔Workpack Event mismatches, cross-tenant
anomalies, orphan Activities, orphan Workpacks.

---

## 20. Behavioural Tests (Phase M)

**NOT RUN — environment defect, not product defect.**

The agent shell in this session cannot execute any command. Evidence: three
independent probes — `node -e "console.log('shell-ok')"` (stalled >280s),
`echo probe-builtin` (>45s), `node -v` (>90s) — all failed to produce output or
exit. A shell builtin stalling rules out a project/toolchain fault and indicates
broken shell integration in the environment.

The suites below exist and are the required evidence. **"Tests exist" is not
reported as "tests pass."**

```
npx vitest run \
src/core/schedule/__tests__/r04e-event-cpm-enqueue.test.ts \
src/core/evm/__tests__/r04e-event-scurve.test.ts \
src/core/m16/__tests__/r04e-event-navigation.test.ts \
src/modules/Workpack/__tests__/r04e-workpack-event-create.test.ts \
src/core/architecture/__tests__/r04e-event-only-boundary.guard.test.ts \
src/core/activity/__tests__/r01-activity-identity-creation.test.ts \
src/core/scope-change/__tests__/r03-scope-change-security.test.ts \
src/core/workpack-identity-review/__tests__/r04d-workpack-identity-review.test.ts \
src/core/schedule/ScheduleOrchestrationService.test.ts \
src/core/m16/__tests__/m16-r2-assistant-core.test.ts \
tests/m11-v1-schedule-view.test.ts
```

Because execution was impossible, the new guard assertions added in this phase
were instead **verified by direct repository search** (each expected-empty scan
was run as a grep and confirmed empty — §23). This is weaker evidence than
execution and is the primary reason for AMBER.

---

## 21. Regression Tests (Phase N)

**NOT RUN.** R0.1, R0.3, R0.4-D, M11 and M16 regression suites were not executed,
for the environment reason in §20. M8.13 / M10 / M12 / M13 / M14 / M15 were also
**NOT RUN**.

"Low risk" has not been converted into "passed."

Known regression risk introduced by this phase, requiring attention on the first
healthy run:

1. Any test asserting the **old** Project s-curve payload (`sCurve` buckets,
   `evm.spi`, or the 422 date error) will now fail — that is the intended
   behaviour change, and such a test is a **stale expectation**, not a product
   defect.
2. Any test rendering `/projects/{id}/ta-dashboard` will now see the retired
   state.

---

## 22. Browser Acceptance (Phase O)

**NOT RUN — BROWSER = AMBER.** No browser could be driven without shell access.

Outstanding required surfaces: Event detail, Event Control Tower, S-curve, Event
navigation, Workpack creation, Workpack Identity Review, M16 navigation, Schedule
page, Event context switching.

The specific acceptance to run first, now that the second EVM engine is retired:

- `/events/{id}/control-tower` for an Event **with** data → S-curve loads.
- `/events/{id}/control-tower` for an Event **without** schedule/progress data →
  exactly `"No schedule/progress data available"`, and **no** 422, **no**
  "Project not found", **no** Project date error. The static path for this is
  confirmed: `app/api/events/[eventId]/schedule/evm/s-curve/route.ts:42-48`.
- Wrong-tenant Event → not found/denied (`:26-32`).
- M16 navigation → `/events/{eventId}/...`, never `/projects/{id}/...`.

---

## 23. Architectural Guard (Phase L)

`src/core/architecture/__tests__/r04e-event-only-boundary.guard.test.ts` was
strengthened. It is **not** a crude "no word Project" test: it scans only `src`
and `app`, and allow-lists `digital-plant`, `imported-schedule`,
`Scheduling/parsers`, `ProjectBranchingService`, and test paths, so
DigitalPlantProject, P6/MS Project interchange and `work_type = Project` remain
legal.

Pre-existing assertions: Event CPM enqueue; worker requires Event; no resolver in
orchestration; Project schedule POST retired; Control Tower S-curve on Event API;
M16 Event navigation; allow-list sanity.

Assertions **added this phase**:

| Guard | Prevents | Verified by grep |
|---|---|---|
| Project S-curve stays retired — no `bcws/bcwp/acwp/spi/cpi/eac`, no `prisma.`, no `project_id`, no `plannedSdDate`, no old 422 string | Return of a second EVM engine | Route contains none of these |
| Workpack creation requires Event (`EVENT_REQUIRED`, `CROSS_TENANT_EVENT`, org-scoped `prisma.event.findFirst`) | Project-based / Event-less STO Workpack creation | `WorkpackService.ts:65-85` |
| No `resolveEventIdFromProject` in any production file | Resolver reintroduction | 0 production hits |
| No `event.find*({ … project_id … })` | Event lookup keyed by Project | 0 hits |
| No `/api/events/${projectId}` or `/events/${projectId}` | The R04-P1-007 conflation regression | 0 hits (was 9 before the fix) |
| Every M16 target, given both ids, avoids `/projects/` | Project campaign URL regression | Registry has no `/projects/` |
| `scheduleRecalculateQueue.add` only inside the Event adapter | Bypassing the Event enqueue chokepoint | 1 production hit — the adapter |

A repo-wide directory walker backs the four scan-based guards, so the protection
applies to files that do not yet exist.

---

## 24. Remaining Defects

**P0 — none.**

**P1 — none outstanding.** Both P1s found this phase (R04-P1-006, R04-P1-007) were
remediated within it. *Caveat:* the remediations are verified statically only;
they are unproven behaviourally (§20, §22).

**P2**

| ID | Item | Notes |
|---|---|---|
| R04-P2-001 | `SeedPackService.ts:797-800` bypasses `WorkpackService` and can create an Event-less Workpack when a seed pack declares no `shutdownEvent` | Admin seeding path; no Project inference; rows fall to human review |
| R04-P2-002 | Legacy `/projects/{id}` display pages and read-only APIs remain reachable by direct URL | No CPM, no EVM, no identity authority; removed from primary navigation |
| R04-P2-003 | `src/components/Dashboard/SCurveChart.tsx` and `ScheduleContainer` `ProjectSCurveChart` still call the retired endpoint | Now render an empty state; candidate for deletion |
| R04-P2-004 | `RouteParams.projectId` / `PipelineInput.projectId` unused leftovers | Documented and guard-covered |

**P3**

| ID | Item |
|---|---|
| R04-P3-001 | Superseded R0.4-B/C/D/E docs still describe `resolveEventIdFromProject` as present |
| R04-P3-002 | `docs/AURIANOA_R0.4E_…_CLOSURE.md` predates the discovery of R04-P1-006/007 and is superseded by this document |

---

## 25. Authority Map (Phase T)

```
Organisation
    ↓
Site / Plant
    ↓
Event / Turnaround          ← SOLE STO operational campaign container
    ↓
Digital Plant / Scope
    ↓
Workpack                    ← requires organization_id + event_id
    ↓
Activity                    ← ActivityCreationCommand; event_id == Workpack.event_id
    ↓
M11 Schedule / CPM          ← sole CPM authority
    ↓
M12 Execution               ← sole execution-write authority
    ↓
M8.13 Progress              ← sole progress/aggregation authority
    ↓
M13 Control Tower           ← presentation only
    ↓
M14 Reports
    ↓
M15 Management Intelligence
    ↓
M16 Interaction             ← Event-route navigation only
```

M8.10 is the sole EVM / S-curve authority, consumed by M13/M14/M15.
M10 remains readiness authority.

Explicitly **not** STO operational containers:

| Concept | Role |
|---|---|
| `DigitalPlantProject` | Engineering / extraction workspace |
| P6 / MS Project | External interchange only |
| `work_type = Project` | Ordinary business classification |

---

## 26. R0.4 Acceptance Matrix

| # | Criterion | Status | Evidence | Test | Browser | Remaining risk |
|---|---|---|---|---|---|---|
| 1 | Event sole STO campaign authority | **PASS (static)** | §9, §25 | NOT RUN | NOT RUN | Unproven behaviourally |
| 2 | No Project→Event inference | **PASS** | §10; 0 production hits | NOT RUN | NOT RUN | Guard-protected |
| 3 | No Event→Project inference | **PASS** | No resolver exists | NOT RUN | NOT RUN | — |
| 4 | CPM Event-authoritative | **PASS (static)** | §10 | NOT RUN | NOT RUN | Unproven behaviourally |
| 5 | No second CPM engine | **PASS** | Single enqueue chokepoint | NOT RUN | NOT RUN | Guard-protected |
| 6 | S-curve M8.10 authoritative | **PASS (static)** | §11 | NOT RUN | NOT RUN | Unproven behaviourally |
| 7 | No second S-curve engine | **PASS (fixed this phase)** | §11, R04-P1-006 | NOT RUN | NOT RUN | Guard-protected |
| 8 | M16 Event navigation | **PASS** | §12; all routes exist | NOT RUN | NOT RUN | — |
| 9 | Workpack creation Event-required | **PASS (static)** | §13 | NOT RUN | NOT RUN | P2 seed path |
| 10 | Activity creation identity-safe | **PASS (static)** | §14 | NOT RUN | NOT RUN | Unproven behaviourally |
| 11 | 177 Event-less Workpacks untouched | **PASS (no code path)** | §13, §19 | NOT RUN | NOT RUN | Census NOT RUN |
| 12 | Human Event Review remains authority | **PASS** | §14; human confirmation required | NOT RUN | NOT RUN | — |
| 13 | Cross-tenant Event denied | **PASS (static)** | §15 | NOT RUN | NOT RUN | Unproven behaviourally |
| 14 | Project not used as security boundary | **PASS** | §16 | NOT RUN | NOT RUN | — |
| 15 | Navigation Event-consistent | **PASS** | §18 | NOT RUN | NOT RUN | — |
| 16 | Architectural guard active | **PASS (written)** | §23 | NOT RUN | n/a | Not executed |
| 17 | Behavioural tests pass | **NOT PROVEN** | §20 | NOT RUN | n/a | **Blocks GREEN** |
| 18 | Regression tests pass | **NOT RUN** | §21 | NOT RUN | n/a | **Blocks GREEN** |
| 19 | Browser acceptance passes | **NOT RUN** | §22 | n/a | NOT RUN | **Blocks GREEN** |
| 20 | No R1 code introduced | **PASS** | §27 | n/a | n/a | — |

---

## 27. Out-of-Scope R1 Items

No R1 work was started, designed, or partially implemented. Items observed during
the audit and deliberately **not** touched:

- **OUT OF SCOPE — R1 / LATER:** time-of-day model; `timestamptz` migration.
- **OUT OF SCOPE — R1 / LATER:** working-calendar CPM. The retired Project EVM
  engine used naive ISO-week bucketing; no calendar model was introduced to
  replace it.
- **OUT OF SCOPE — R1 / LATER:** automatic predecessor date propagation.
- **OUT OF SCOPE — R1 / LATER:** `planned_start` / `early_start` unification —
  both fields are still read side by side in schedule consumers.
- **OUT OF SCOPE — R1 / LATER:** schedule recalculation architecture redesign;
  material propagation; readiness/execution/progress redesign.
- **OUT OF SCOPE — R1 / LATER:** new S-curve, new CPM, new Event resolver, new
  Project migration.

Non-atomic template instantiation (a committed draft Workpack can survive a failed
transaction — `TemplateLibraryService`) is a pre-existing integrity concern
recorded in the R0 identity scope document. It is unrelated to the Event boundary
and was **not** addressed here.

---

## 28. Final Decision

**AMBER. R1 remains BLOCKED.**

Code is now, on static evidence, GREEN — including two Critical-Stop-Condition
defects found and fixed in this phase. However the Final Decision Rule requires
targeted tests, regression, and browser acceptance to pass. None could be
executed because the environment's shell will not run any command. Per Phase O
and §27 of the brief, that mandates AMBER.

There is no known remaining P0 or P1, and no unexplained STO Project authority.
The gap is **verification**, not implementation.

**To reach GREEN**, on a healthy runner: execute §20, then §21, then §22. Expect
the two stale expectations noted in §21.

---

## 29. Evidence / Commands

Static evidence gathered in this phase (shell unavailable; repository search and
file reads only):

| Check | Result |
|---|---|
| `resolveEventIdFromProject` in `src/`, `app/` | 0 hits |
| `scheduleRecalculateQueue.add` in production | 1 hit (`enqueueEventScheduleRecalculate.ts:53`) |
| `/api/events/${projectId}` / `/events/${projectId}` | 0 hits (9 before fix) |
| `event.find*({ … project_id … })` | 0 hits |
| `prisma.workpack.create` in production | 2 hits: `WorkpackService.ts:115` (guarded), `SeedPackService.ts:797` (P2) |
| M16 Event routes existing as pages | 5 of 5 |
| Shell probes (`node -e`, `echo`, `node -v`) | All stalled; no output, no exit |

Commands to run for closure: §20 (targeted), §21 (regression), §22 (browser).

---

## 30. Rollback / Safety Notes

- **No database migration, and no data modification, in this phase.** The 177
  Event-less Workpacks were not touched.
- **Reversible changes**, all source-only:
  1. `app/api/projects/[id]/s-curve/route.ts` — EVM engine retired. Rollback
     restores a second EVM engine and re-violates frozen decision #22; do not
     roll back without reinstating an Event-authoritative replacement.
  2. `app/(dashboard)/projects/[id]/ta-dashboard/page.tsx` — duplicate surface
     replaced by a retired state. The prior 1,300-line client component is
     recoverable from git history; it should not be restored as-is because it
     conflates Project and Event identity.
  3. `src/core/architecture/__tests__/r04e-event-only-boundary.guard.test.ts` —
     guard strengthened; test-only.
- **Consumer safety:** the retired s-curve endpoint keeps its response shape
  (`sCurve`, `series`, `evm`), so legacy consumers degrade to their documented
  empty state rather than erroring. `ProjectDetailClient` reads `d.spi ??
  1` / `d.latestPlanned ?? 0`, which were already absent from the old payload, so
  its KPI tiles are unchanged.
- **Forward-only risk:** if the first healthy test run reveals a failure in the
  retired-route guards, prefer fixing the guard's expectation over restoring
  Project EVM authority.
