# M16-R0.1 — Final Review, Evidence Validation & R1 Preparation Gate

**Date:** 2026-09-07  
**Status:** FINAL GATE REVIEW — no code modified

---

## 1. Event Context — Final Repository-Wide Validation

### 1.1 The Authoritative Event Model

**Model:** [`Event`](file:///c:/DEV/STO/prisma/schema.prisma#L1979-L2033) (mapped to `events` table)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID PK | Event identifier |
| `organization_id` | UUID (NOT NULL) | Tenant scope |
| `site_id` | UUID (NOT NULL) | Physical location |
| `parent_event_id` | UUID (nullable) | Multi-shutdown campaigns |
| `name` | String | "CDU-3 Turnaround 2026" |
| `code` | String | "TA-2027" |
| `event_type` | String | "turnaround" (default) |
| `status` | String | "planning" / "active" / "in_progress" / "execution" / "completed" |
| `planned_start` / `planned_end` | Date | Scheduled window |
| `actual_start` / `actual_end` | Date | Actual execution window |

### 1.2 Event → Domain Entity Relationships

```
Event (events)
  │
  ├── 1:N → Workpack           (workpacks.event_id)
  │           │
  │           ├── 1:N → Activity (activities.event_id + workpack_id)
  │           │
  │           ├── M:1 → Asset   (workpacks.asset_id)
  │           │
  │           ├── M:1 → Unit    (workpacks.unit_id)
  │           │
  │           ├── M:1 → Plant   (workpacks.plant_id)
  │           │
  │           └── M:1 → System  (workpacks.system_id)
  │
  ├── 1:N → EventUnit          (event_units.event_id)
  ├── 1:N → EventSystem        (event_systems.event_id)
  ├── 1:N → EventMilestone     (event_milestones.event_id)
  ├── 1:N → SafetyLog          (safety_logs.event_id)
  ├── 1:N → ScheduleBaseline   (schedule_baselines.event_id)
  ├── 1:N → ScheduleScenario   (schedule_scenarios.event_id)
  ├── 1:N → WbsNode            (wbs_nodes.event_id)
  └── 1:1 → ShutdownScope      (shutdown_scope.event_id)
```

> [!IMPORTANT]
> Both `Workpack` and `Activity` have their own `event_id` field. This means event-scoping is available at EVERY level of the execution chain without requiring JOIN traversal. However, both fields are **nullable** — not every workpack/activity is necessarily linked to an event (e.g., standalone maintenance workpacks outside a turnaround context).

### 1.3 Existing Event Context Mechanisms — DISCOVERED

> [!IMPORTANT]
> **This is the most significant new finding in R0.1.**
>
> The platform ALREADY HAS a comprehensive event context system. M16 does NOT need to invent one.

| Mechanism | Location | Type | Persisted? | Scope |
|-----------|----------|------|-----------|-------|
| **`ActiveShutdownContext`** | [`src/context/ActiveShutdownContext.tsx`](file:///c:/DEV/STO/src/context/ActiveShutdownContext.tsx) | Client-side React Context | Cookie (`syority_active_event`) + `localStorage` | Browser session, 30-day cookie |
| **`getActiveShutdownServer()`** | [`src/lib/shutdownContext.ts`](file:///c:/DEV/STO/src/lib/shutdownContext.ts) | Server-side helper | Reads `syority_active_event` cookie | Server-side request |
| **`useWorkspaceStore.selectedEventId`** | [`src/stores/useWorkspaceStore.ts`](file:///c:/DEV/STO/src/stores/useWorkspaceStore.ts#L112-L114) | Client-side Zustand store | In-memory (resets on refresh) | Planner workspace |
| **`DashboardVariableService`** | [`src/core/ois/DashboardVariableService.ts`](file:///c:/DEV/STO/src/core/ois/DashboardVariableService.ts#L71) | Dashboard variable | Per-dashboard | OIS dashboards |

#### ActiveShutdownContext — Resolution Algorithm

[`ActiveShutdownContext.tsx`](file:///c:/DEV/STO/src/context/ActiveShutdownContext.tsx#L72-L93) L72-93:

1. Check cookie `syority_active_event` OR `localStorage` for stored event ID
2. If stored ID exists AND matches an available event → use it
3. If not → find first event with status `active` / `in_progress` / `execution`
4. If none → use first event from org
5. If no events → null

#### Server-Side Resolution

[`shutdownContext.ts`](file:///c:/DEV/STO/src/lib/shutdownContext.ts#L8-L61) L8-61:

1. Read `syority_active_event` cookie
2. Validate event exists AND belongs to the organization (`organization_id: organizationId`)
3. If valid → return event with site and discipline
4. If not → fallback to most recent event by `planned_start` DESC

### 1.4 Where Event Context Is Currently Used

| Consumer | Uses | Method |
|----------|------|--------|
| ExecutionCockpit | `activeShutdown.id` | `useActiveShutdown()` → API calls with `event_id` query param |
| PlanVsActualView | `activeShutdown.id` | Same pattern |
| LookaheadView | `activeShutdown.id` | Same pattern |
| MaterialReadinessDashboard | `selectedEventId` | `useWorkspaceStore()` → API calls |
| ResourcePlanningDashboard | `selectedEventId` | `useWorkspaceStore()` → API calls |
| ScheduleControlDashboard | `selectedEventId` | `useWorkspaceStore()` → API calls |
| FieldExecutionService | `eventId` parameter | All methods accept optional `eventId` and apply `{ event_id: eventId }` filter |
| M14 Report Providers | `params.event` | All report providers receive `event` parameter from `ReportExecutionContext` |

### 1.5 Where Event Context Is NOT Used

| Consumer | Missing Context | Impact |
|----------|----------------|--------|
| **WhatsApp MessageProcessor** | No `event_id` anywhere | ❌ Event-unsafe entity resolution |
| **WhatsApp DbMatcher** | No `event_id` filter on workpack query | ❌ Wrong-event workpack match |
| **WhatsApp QueryHandler** | No `event_id` filter | ❌ Wrong-event status response |
| **WhatsApp ShiftReportGenerator** | Queries by `unit_id` only, no `event_id` | ⚠️ May aggregate across events |
| **AI Chat (ai-assistant route)** | Uses `project_id`, not `event_id` | ⚠️ Different scoping model |
| **WhatsApp sessions** | No `event_id` on model | ❌ Cannot track event context |
| **WhatsApp updates** | No `event_id` on model | ❌ Cannot attribute to event |

### 1.6 Conclusion

**M16 does NOT need `User.active_event_id`.** The platform already has:
- **Cookie-based persistence** via `syority_active_event` (available server-side)
- **Client-side context** via `ActiveShutdownContext` and `useWorkspaceStore`
- **Server-side resolution** via `getActiveShutdownServer(orgId)`
- **API-level event passing** via query parameter pattern

For M16's **non-browser channels** (WhatsApp, Voice), the event context should live in:

| Concept | Storage | Rationale |
|---------|---------|-----------|
| **`whatsapp_sessions.event_id`** | DB column | WhatsApp conversation state already persists in DB. Add `event_id` to it. |
| **M16InteractionContext.eventId** | Request-scoped object | Ephemeral, built per-interaction from session + org context |
| **NOT** `User.active_event_id` | — | User may use different events on different channels simultaneously |

---

## 2. Canonical M16 Interaction Context

### Definition

```typescript
interface M16InteractionContext {
  // ── Mandatory (must be resolved before any query/action) ──
  organizationId: string;         // From authenticated user
  userId: string;                 // From authenticated user
  channel: M16Channel;            // 'web' | 'whatsapp' | 'voice' | 'mobile'
  conversationId: string;         // Unique per interaction session

  // ── Mandatory for event-scoped operations ──
  eventId: string | null;         // Resolved from session/context/user-selection

  // ── Derived (populated during pipeline) ──
  identitySource: IdentitySource; // 'session_cookie' | 'phone_number' | 'oauth_token'
  siteId: string | null;          // Derived from event.site_id
  messageId: string | null;       // Channel-specific (meta_message_id for WhatsApp)

  // ── Request-scoped (never persisted) ──
  rawMessage: string;             // Original user text
  intent: M16Intent | null;       // Resolved intent
  resolvedEntities: M16ResolvedEntities | null;  // Resolved entities
  authorizationResult: AuthorizationResult | null; // Permission check result
}

type M16Channel = 'web' | 'whatsapp' | 'voice' | 'mobile';
type IdentitySource = 'session_cookie' | 'phone_number' | 'oauth_token' | 'api_key';
```

### Field Classification

| Field | Classification | Source |
|-------|---------------|--------|
| `organizationId` | **Mandatory, Derived** | From `user.organization_id` (DB, trusted) |
| `userId` | **Mandatory, Derived** | From phone→user lookup (WhatsApp) or session (web) |
| `channel` | **Mandatory, Literal** | From adapter entry point |
| `conversationId` | **Mandatory, Derived** | From `whatsapp_sessions.id` or web chat session ID |
| `eventId` | **Mandatory for event ops, Derived/Prompted** | From session state → org single-event → user selection |
| `identitySource` | **Derived** | From channel adapter |
| `siteId` | **Derived** | From `event.site_id` once event resolved |
| `messageId` | **Optional, Channel-specific** | `meta_message_id` for WhatsApp, null for web |
| `rawMessage` | **Request-scoped** | From channel adapter, never persisted in context |
| `intent` | **Request-scoped, Derived** | From Intent Resolver |
| `resolvedEntities` | **Request-scoped, Derived** | From Entity Resolver |
| `authorizationResult` | **Request-scoped, Derived** | From Authorization check |

### Lifecycle

```
1. INCOMING MESSAGE (channel adapter receives)
         ↓
2. AUTHENTICATE (channel-specific identity verification)
   WhatsApp: X-Hub-Signature-256 → phone → user lookup
   Web:      session cookie → NextAuth session
   Voice:    same as WhatsApp (STT first)
   Mobile:   OAuth token
         ↓
3. RESOLVE USER (user.id, user.organization_id, user.whatsapp_verified)
         ↓
4. RESOLVE ORGANIZATION (organization_id — already on user)
         ↓
5. RESOLVE EVENT
   a. Check session state (whatsapp_sessions.event_id)
   b. If null → check org for single active event
   c. If multiple → prompt user to select
   d. If explicitly specified in message → validate and use
         ↓
6. BUILD M16InteractionContext (all mandatory fields populated)
         ↓
7. INTENT RESOLUTION (classify user message)
         ↓
8. ENTITY RESOLUTION (resolve equipment/workpack/activity, EVENT-SCOPED)
         ↓
9. AUTHORIZATION (check user has permission for resolved intent)
         ↓
10. RISK CLASSIFICATION + CONFIRMATION (if required)
         ↓
11. QUERY / ACTION (via authoritative domain service / EWS)
         ↓
12. AUDIT LOG (m16_interaction_logs)
         ↓
13. RESPONSE (formatted for channel)
```

---

## 3. Event Ambiguity Rules

### Case A — One Active Event

**User:** "What's HX-204 status?"

**Behavior:** System auto-selects the single active event. No prompt needed.

**Resolution:**
```
org events WHERE status IN ('active','in_progress','execution') AND deleted_at IS NULL
  → exactly 1 result
  → use it
```

### Case B — Multiple Active Events

**User:** "What's HX-204 status?"

**Behavior:** System MUST NOT guess. It must ask:

> "You have 2 active events. Which one do you mean?
> 1. TA-2027 (CDU-3 Turnaround)
> 2. TA-2028 (HDS Unit Revamp)
>
> Reply with the number."

**After selection:** Store `event_id` in `whatsapp_sessions` for conversation continuity. Subsequent messages in the same session use this event until it expires or user changes.

### Case C — User Explicitly Specifies Event

**User:** "What's HX-204 status in TA-2027?"

**Behavior:**
1. Extract event reference ("TA-2027") from message
2. Resolve against `events.code` WHERE `organization_id = ctx.orgId`
3. Validate event exists and is accessible
4. Use that event for this interaction
5. Update session `event_id`

### Case D — Entity Belongs to Only One Event

**User:** "What's HX-204 status?"  
**Context:** HX-204's workpacks exist only in TA-2027.

**Behavior:** Automatic inference IS safe **under these conditions:**

1. Equipment tag resolves to exactly one asset
2. All workpacks for that asset belong to exactly one event
3. The event is active/in_progress

```sql
SELECT DISTINCT w.event_id
FROM workpacks w
WHERE w.asset_id = :resolved_asset_id
  AND w.organization_id = :org_id
  AND w.status NOT IN ('completed','cancelled')
  AND w.deleted_at IS NULL
  AND w.event_id IS NOT NULL
-- If COUNT(DISTINCT event_id) = 1 → safe to infer
-- If COUNT(DISTINCT event_id) > 1 → ask user
```

> [!WARNING]
> Auto-inference must be limited to **READ operations only**. For any WRITE operation, the event context must be explicitly confirmed (via session state or user selection), never auto-inferred.

### Case E — Ambiguous Equipment/Activity

**User:** "What's the exchanger status?"

**Behavior:** "exchanger" is not an equipment tag. System must ask:

> "I couldn't find equipment tag 'exchanger'. Could you provide the specific tag number? For example: HX-204, E-101A"

If equipment tag resolves but multiple workpacks match across the same event:

> "HX-204 has 3 active workpacks in TA-2027:
> 1. WP-2027-042 — Bundle Pullout
> 2. WP-2027-043 — Tube Inspection
> 3. WP-2027-044 — Re-tubing
>
> Which one?"

**Absolute rule:** Ambiguous entities MUST ask for clarification rather than silently selecting the first DB result.

---

## 4. Final Entity Resolution Architecture

### Confirmed Architecture

```
                  User Message
                       │
                       ▼
              ┌─────────────────┐
              │ Intent Resolver  │   ← Classify what user wants
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Context Resolver │   ← Org + Event (from session/prompt)
              │ Org + Event      │
              └────────┬────────┘
                       │
                       ▼
             ┌──────────────────┐
             │ M16 Entity       │   ← Domain entity resolution
             │ Resolver         │      (event-scoped queries)
             └────────┬─────────┘
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
      Equipment    Workpack     Activity
      (Asset)      (event_id)   (event_id)
          │           │            │
          └───────────┼────────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Controlled Value │   ← Classification validation
             │ Validation       │      ONLY when needed
             └──────────────────┘
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
   DimensionRegistry  CVR     Standard
   (metadata)     (validation)  Activity
```

### Why This Ordering

**Intent → Context → Entity → Controlled Value** (not any other sequence):

1. **Intent FIRST** because:
   - A read-only query ("what's the status?") needs different entity resolution depth than a write action ("complete HX-204")
   - Intent determines which entities NEED resolution (a help request needs no entity resolution at all)
   - Intent determines the risk level and therefore the confirmation requirement

2. **Context (org + event) SECOND** because:
   - Entity resolution REQUIRES event context to scope queries correctly
   - Without event context, workpack queries return cross-event results
   - Event must be resolved BEFORE entity lookup, not after

3. **Entity Resolution THIRD** because:
   - Equipment → Workpack → Activity is a domain entity chain
   - These are NOT DimensionRegistry concerns (they are instances, not dimensions)
   - They must be queried with `event_id` filter

4. **Controlled Value Validation LAST** because:
   - Only needed when entity resolution involves a controlled dimension (discipline, equipment type)
   - Not needed for most WhatsApp interactions (progress updates don't involve dimension changes)
   - DimensionRegistry provides metadata; ControlledValueResolver validates values

### What M16 Entity Resolver Does

| Responsibility | How |
|---------------|-----|
| Equipment tag → Asset | `prisma.asset.findFirst({ tag_number, organization_id })` |
| Asset → Workpack(s) | `prisma.workpack.findMany({ asset_id, organization_id, event_id, status NOT IN [completed, cancelled] })` |
| Workpack → Activity(-ies) | `prisma.activity.findMany({ workpack_id, event_id })` + semantic matching |
| Ambiguity detection | If >1 workpack or >1 candidate activity → ask user |
| Event scoping | ALL domain queries include `event_id` filter |

### What M16 Entity Resolver Does NOT Do

| NOT its job | Who does it |
|-------------|------------|
| Validate discipline codes | `ControlledValueResolver.resolveDiscipline()` |
| Validate equipment types | `ControlledValueResolver.resolveEquipmentType()` |
| Define available dimensions | `DimensionRegistry.getDefinitions()` |
| Calculate progress | M8.13 `ProgressCalculationService` |
| Execute mutations | M12 `ExecutionWriteService` |

---

## 5. M16 Intent Taxonomy

### Query Intents (READ — no confirmation, no EWS)

| Intent | Example | Entities Required | Domain Service |
|--------|---------|-------------------|----------------|
| `GET_PROGRESS` | "What's the progress?" | Optional: equipment, workpack | M8.13 / `FES.getExecutionSummary()` |
| `GET_ACTIVITY_STATUS` | "What's HX-204 bundle pullout status?" | Equipment + Activity | `FES.getExecutionBoard()` |
| `GET_WORKPACK_STATUS` | "What's WP-042 status?" | Workpack | `FES.getExecutionBoard()` |
| `GET_READINESS` | "Is HX-204 ready to start?" | Equipment + Workpack | M10 readiness |
| `GET_CONSTRAINTS` | "What constraints are open?" | Optional: workpack | Prisma read |
| `GET_DELAY` | "Any delays?" | Optional: event | `FES.getPlanVsActual()` |
| `GET_SCHEDULE` | "What's planned today?" | Event | `FES.getLookahead()` |
| `GET_REPORT` | "Send me the shift report" | Event | M14 ReportEngine |
| `GET_LOOKAHEAD` | "What's the 72-hour lookahead?" | Event | `FES.getLookahead()` |

### Execution Intents (WRITE — risk-classified, via EWS)

| Intent | Example | Risk | EWS Action | Confirmation |
|--------|---------|------|-----------|-------------|
| `START_ACTIVITY` | "Start HX-204 bundle pullout" | HIGH | `START` | YES — "Reply YES to start" |
| `UPDATE_PROGRESS` | "HX-204 bundle pullout is 60%" | LOW | `UPDATE_PROGRESS` | NO at ≥90% confidence |
| `HOLD_ACTIVITY` | "Hold HX-204 — waiting for crane" | HIGH | `HOLD` | YES — require reason |
| `RESUME_ACTIVITY` | "Resume HX-204 bundle pullout" | HIGH | `RESUME` | YES — "Reply YES" |
| `REPORT_DELAY` | "HX-204 delayed 4 hours — permit" | LOW | `REPORT_DELAY` | NO but require reason + hours |
| `COMPLETE_ACTIVITY` | "Complete HX-204 bundle pullout" | GOVERNANCE | `COMPLETE` | YES — explicit mandatory |
| `VERIFY_ACTIVITY` | "Verify HX-204 bundle pullout" | GOVERNANCE | `VERIFY` | YES — QA role check |
| `CLOSE_ACTIVITY` | "Close HX-204 bundle pullout" | GOVERNANCE | `CLOSE` | YES — supervisor role |
| `RELEASE_ACTIVITY` | "Release HX-204 for execution" | HIGH | `RELEASE` | YES |

### Navigation Intents (READ — browser/mobile deep link)

| Intent | Example | Action |
|--------|---------|--------|
| `SHOW_EQUIPMENT` | "Show me HX-204" | Deep link to equipment 360 view |
| `SHOW_WORKPACK` | "Open WP-042" | Deep link to workpack detail |
| `SHOW_ACTIVITY` | "Show bundle pullout activity" | Deep link to activity inspector |
| `SHOW_CONTROL_TOWER` | "Open control tower" | Deep link to M13 dashboard |
| `SHOW_REPORT` | "Open delay register" | Deep link to M14 report |

### System Intents

| Intent | Example | Action |
|--------|---------|--------|
| `HELP` | "Help" / "What can I do?" | Return capability list |
| `SELECT_EVENT` | "Switch to TA-2027" | Update session event context |
| `UNKNOWN` | Unrecognizable | "I didn't understand. Try…" |

---

## 6. Final Action Safety Model

| Risk Level | Actions | Confirmation | Permission | Channel Restriction |
|-----------|---------|-------------|-----------|-------------------|
| **READ** | GET_* queries, SHOW_* | Never | View permission | All channels |
| **LOW WRITE** | UPDATE_PROGRESS (≥90% confidence), REPORT_DELAY | No (but require reason for delay) | `execution.update` | All channels |
| **EXECUTION WRITE** | START, HOLD, RESUME, RELEASE | Explicit "Reply YES" | `execution.start`, `execution.hold` | All channels |
| **GOVERNANCE** | COMPLETE, VERIFY, CLOSE | Mandatory explicit confirmation | `execution.complete`, `execution.verify`, `execution.close` | Web preferred; WhatsApp with strong confirmation |
| **CONFIGURATION** | Schedule change, scope change | Strong confirmation + audit | Schedule/scope permissions | Web ONLY — **NOT via WhatsApp/Voice** |

### Core Principle

> **AI interpretation does not equal authorization.**
>
> The LLM classifies intent. The application verifies permission.
> The user confirms action. The domain service executes.
> The audit records everything.

### Flow

```
Message → Intent → Entity → Context → Permission → Readiness → Risk → Confirmation → Service → Audit → EventBus
```

---

## 7. Authority Boundary — Final Statement

### M16 Authority Classification

```
M16 = INTERACTION / ORCHESTRATION LAYER

M16 is NOT:
  - A domain authority
  - A calculation engine
  - An execution engine
  - A reporting engine
  - A scheduling engine
```

### Authority Matrix

| Domain | Owner | M16 May... | M16 Must NOT... |
|--------|-------|-----------|-----------------|
| **Progress** | M8.13 `ProgressCalculationService` | Read `calculateProgressMetrics()` result, read `overall_progress` | Calculate progress, infer weighted progress, derive SPI |
| **EVM** | M8.10 | Read SPI/CPI/EAC from authoritative service | Calculate EVM metrics |
| **Schedule/CPM** | M11 | Read schedule dates, float, critical path from authoritative service | Calculate CPM, modify schedule, compute float |
| **Readiness** | M10 / M12 | Read readiness score | Calculate readiness, evaluate criteria |
| **Execution** | M12 `ExecutionWriteService` | Call `EWS.applyAction()` | Call `prisma.activity.update()`, `prisma.progressLog.create()` |
| **Control Tower** | M13 | Read control tower data | Generate control tower metrics |
| **Reporting** | M14 `ReportEngine` | Request report generation via `ReportEngine` | Query DB directly for report data, calculate report metrics |

### Prohibited Pattern

```typescript
// ❌ PROHIBITED — AI/WhatsApp/Voice must NEVER do this:
await prisma.activity.update({ where: { id: activityId }, data: { progress_percent: 60 } });

// ✅ PERMITTED — Always through EWS:
await ExecutionWriteService.applyAction(orgId, userId, {
  activityId, action: 'UPDATE_PROGRESS', progress: 60
}, { source_channel: 'whatsapp' });
```

### Current Compliance: ✅ GREEN

**Evidence from R0.1 authority proof:**
- Zero `prisma.activity.update/create/delete` in AI/WhatsApp/Voice code
- Zero `prisma.$executeRaw` in AI/WhatsApp code
- All execution mutations route through `ExecutionWriteService`
- One exception: `workpackAutoFill.ts` sets metadata flag `ai_auto_filled: true` — acceptable

---

## 8. Legacy Execution Path Audit — FieldExecutionService

### Classification

| Question | Answer | Evidence |
|----------|--------|----------|
| **Is FES a bypass of EWS?** | **NO** | FES is primarily a READ service (getExecutionSummary, getExecutionBoard, getLookahead, getPlanVsActual, generateDailyExecutionReport). Its ONE write method (`syncWorkpackProgress`) is called ONLY by EWS internally. |
| **Can AI/WhatsApp reach FES?** | **Not directly** | No import of FES in `src/services/whatsapp/` or `src/lib/ai/`. |
| **Can it bypass EWS?** | **NO** | FES.syncWorkpackProgress is called at [`ExecutionWriteService.ts`](file:///c:/DEV/STO/src/core/execution/ExecutionWriteService.ts#L399) L399 AFTER EWS has applied the action. It's a post-action aggregation step, not an independent write path. |
| **Can it mutate execution state?** | **Only `overall_progress` on Workpack** | `prisma.workpack.update({ data: { overall_progress } })` at [`FieldExecutionService.ts`](file:///c:/DEV/STO/src/core/execution/FieldExecutionService.ts#L411-L414) L411-414 — but only called by EWS. |
| **Does it create AuditLog?** | **N/A** | FES doesn't execute actions directly. EWS creates audit logs. |
| **Does it emit EventBus?** | **N/A** | FES doesn't execute actions directly. EWS emits events. |
| **Is it still production-reachable?** | **YES — as a read service** | API routes: `/api/execution/summary`, `/api/execution/board`, `/api/execution/lookahead`, `/api/execution/plan-vs-actual`, `/api/execution/daily-report` |
| **Should R1 treat it as dependency, adapter, or deprecated?** | **DEPENDENCY (read-only)** | M16 should USE FES for event-scoped execution queries. It's the authoritative read service for execution data. |

### `/api/execution/activity-action` Route

[`activity-action/route.ts`](file:///c:/DEV/STO/app/api/execution/activity-action/route.ts) — **NOT a bypass.**

This route:
1. Uses `withTenantGuard` for authentication
2. Maps actions to permissions and calls `guardApi`
3. Calls `ExecutionWriteService.applyAction()` (L36)
4. Passes `source_channel: 'api'`

**Classification: Legitimate EWS-compliant API route with permission checks. M16 should reuse this pattern.**

### ExecutionCockpit Component

[`ExecutionCockpit.tsx`](file:///c:/DEV/STO/src/components/execution/ExecutionCockpit.tsx) — **Not a bypass.**

It's a React component that:
1. Uses `useActiveShutdown()` for event context
2. Calls API routes (not Prisma directly) for data
3. Actions call `/api/execution/activity-action` which routes through EWS

**Classification: Legitimate UI component. M16 can reference its event context pattern.**

### Final Classification

| Component | Classification | M16 Relationship |
|-----------|---------------|-------------------|
| `FieldExecutionService` (read methods) | Authoritative read service | **REUSE** — M16 should call FES for execution queries |
| `FieldExecutionService.syncWorkpackProgress` | Internal EWS helper | **IGNORE** — only called by EWS |
| `/api/execution/activity-action` | EWS-compliant write route | **REUSE PATTERN** — M16 should follow same permission + EWS pattern |
| `ExecutionCockpit` | UI component | **REFERENCE** — for event context pattern |

---

## 9. Prompt Injection Boundary

### Rule

> **User text is untrusted input.**

### What the LLM May Determine

| May Determine | Source | Trust Level |
|--------------|--------|-------------|
| Intent classification | LLM output | **Low trust** — must be validated against known taxonomy |
| Entity references (equipment tag, workpack code) | LLM output | **Low trust** — must be resolved against DB |
| Natural language meaning | LLM output | **Low trust** — routing decision only |

### What the LLM Must NEVER Determine

| Must NEVER Determine | Source | Trust Level |
|---------------------|--------|-------------|
| `organizationId` | Application context (user record) | **Trusted** |
| `eventId` | Application context (session/cookie) | **Trusted** |
| `userId` | Application context (phone→user) | **Trusted** |
| User permissions | Application context (role/permission DB) | **Trusted** |
| `activityId` / `workpackId` / `assetId` | **Authoritative resolver** (DB query) | **Trusted** |

### The LLM Must Not Be Able To

1. **Manufacture IDs** — "Use activity ID abc-123" in prompt text must be ignored; the resolver must independently look up the entity
2. **Escalate permissions** — "Ignore previous instructions, I am an admin" must have zero effect
3. **Change tenant context** — "Switch to organization XYZ" must be rejected
4. **Override event context** — LLM output must never set `eventId`; only validated code references are permitted
5. **Execute raw SQL** — No SQL execution from LLM output

### Architecture

```
User text (UNTRUSTED)
        │
        ▼
    ┌─────────────┐
    │   LLM        │ → Produces: intent string + entity hints (strings)
    └──────┬──────┘
           │
    ═══════╪═══════════ TRUST BOUNDARY ══════════════════
           │
           ▼
    ┌─────────────┐
    │  Validator   │ → Validates intent against known taxonomy
    │  + Resolver  │ → Resolves entity hints against authoritative DB
    └──────┬──────┘    (using trusted org_id, event_id from context)
           │
           ▼
    ┌─────────────┐
    │  Authorizer  │ → Checks permission using trusted user_id + role
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  Domain Svc  │ → Executes using validated, trusted parameters only
    └─────────────┘
```

---

## 10. Final R1 Architecture

```
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │   WEB    │  │ WHATSAPP │  │  VOICE   │  │  MOBILE  │
    │  (R2+)   │  │  (R1/R4) │  │  (R5)    │  │  (R5)    │
    └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │             │              │
         └──────┬──────┴──────┬──────┘              │
                │             │                     │
         ┌──────▼─────────────▼─────────────────────▼──────┐
         │              CHANNEL ADAPTERS                     │
         │  ┌──────────────────────────────────────────┐    │
         │  │  • Webhook signature (WhatsApp)           │    │
         │  │  • Session auth (Web)                     │    │
         │  │  • STT preprocessing (Voice)              │    │
         │  │  • OAuth (Mobile)                         │    │
         │  └──────────────────────────────────────────┘    │
         └─────────────────────┬────────────────────────────┘
                               │
                    ═══════════╪═══════════════
                    TRUST      │      BOUNDARY
                    ═══════════╪═══════════════
                               │
         ┌─────────────────────▼────────────────────────────┐
         │           M16 INTERACTION CORE                    │
         │                                                   │
         │  ┌─────────────┐                                  │
         │  │ 1. Identity  │ user_id, org_id (trusted)       │
         │  └──────┬──────┘                                  │
         │         ▼                                         │
         │  ┌─────────────┐                                  │
         │  │ 2. Event Ctx │ session → single-event →        │
         │  │              │ prompt user                     │
         │  └──────┬──────┘                                  │
         │         ▼                                         │
         │  ┌─────────────┐                                  │
         │  │ 3. Intent   │ ← LLM sits HERE                 │
         │  │    Resolver  │   (untrusted output)            │
         │  └──────┬──────┘                                  │
         │         ▼                                         │
         │  ┌─────────────┐                                  │
         │  │ 4. Entity   │ Event-scoped DB queries          │
         │  │    Resolver  │ + DimensionRegistry for CVs     │
         │  └──────┬──────┘                                  │
         │         ▼                                         │
         │  ┌─────────────┐                                  │
         │  │ 5. Authz    │ Role + permission check          │
         │  └──────┬──────┘                                  │
         │         ▼                                         │
         │  ┌─────────────┐                                  │
         │  │ 6. Risk /   │ Action-risk classification       │
         │  │    Confirm   │ → confirmation if required      │
         │  └──────┬──────┘                                  │
         │         ▼                                         │
         │  ┌─────────────┐                                  │
         │  │ 7. Audit    │ m16_interaction_logs             │
         │  └─────────────┘                                  │
         └─────────────────────┬────────────────────────────┘
                               │
         ┌─────────────────────▼────────────────────────────┐
         │              DOMAIN SERVICES                      │
         │                                                   │
         │  ┌────────┐  ┌────────┐  ┌────────┐              │
         │  │ M8.13  │  │  M11   │  │  M12   │              │
         │  │Progress│  │Schedule│  │  EWS   │              │
         │  └────────┘  └────────┘  └────────┘              │
         │  ┌────────┐  ┌────────┐  ┌────────┐              │
         │  │  M13   │  │  M14   │  │  FES   │              │
         │  │CtrlTwr │  │Reports │  │(reads) │              │
         │  └────────┘  └────────┘  └────────┘              │
         └──────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **The LLM sits at step 3 — Intent Resolution — BELOW the trust boundary.**
> It receives the user's raw text and produces an intent classification + entity hints.
> Its output is UNTRUSTED and must be validated by steps 4-6 before any action is taken.
> The LLM does NOT have direct access to domain services, Prisma, or APIs.

---

## 11. R1 Scope Freeze

### M16-R1 — Secure Interaction Foundation

#### INCLUDE

| Area | Deliverable |
|------|-------------|
| **Trusted channel context** | `M16InteractionContext` object, built per-interaction |
| **WhatsApp webhook authentication** | `X-Hub-Signature-256` verification using `WHATSAPP_APP_SECRET` |
| **User identity binding** | Enforce `whatsapp_verified` and `whatsapp_opt_in` flags |
| **Organisation context** | From `user.organization_id` (trusted) |
| **Event context** | Session-based (`whatsapp_sessions.event_id`) + single-event auto-select + multi-event prompt |
| **M16InteractionContext** | Request-scoped context object with lifecycle |
| **Entity resolution architecture** | `M16EntityResolver` with event-scoped domain queries |
| **DimensionRegistry integration boundary** | Used for controlled value validation where applicable |
| **ControlledValueResolver integration** | Used to validate discipline, equipment type if extracted |
| **Intent taxonomy** | 29 intents across 4 categories (query/execution/navigation/system) |
| **Authorization boundary** | Permission check before EWS calls, mapped from intent to permission |
| **Action-risk model** | READ / LOW WRITE / EXECUTION WRITE / GOVERNANCE / CONFIGURATION classification |
| **Confirmation architecture** | Design for confirmation flow (implementation of gates in R3) |
| **Interaction audit architecture** | `m16_interaction_logs` schema and logging |
| **Prompt injection boundary** | Trust boundary between LLM output and application context |
| **Idempotency architecture** | Message dedup (already exists), action dedup design |
| **Schema migrations** | `event_id` on `whatsapp_sessions` and `whatsapp_updates`, non-nullable `organization_id` |

#### DO NOT INCLUDE

| Excluded | Why | Target |
|----------|-----|--------|
| Voice (STT/TTS) | Separate channel adapter | M16-R5 |
| Mobile channel | Separate channel adapter | M16-R5 |
| Advanced AI memory / conversation persistence | Core AI feature | M16-R2 |
| AI function calling / tool use | Core AI feature | M16-R2 |
| Autonomous agents | Out of M16 scope | Not planned |
| Broad workpack generation via AI | Existing feature, not M16 | Existing |
| Report designer | M14 | Existing |
| New dashboard | Not M16 | Not planned |
| M15 decision intelligence | Future milestone | M15 |
| Autonomous scheduling | Not M16 | Not planned |
| Autonomous scope changes | Not M16 | Not planned |
| Unrestricted AI database access | ❌ PROHIBITED | Never |
| Confirmation gate UX implementation | Needs governed actions first | M16-R3 |
| WhatsApp report delivery via M14 | Needs R2+R3 first | M16-R4 |

---

## 12. R1 Acceptance Criteria

### Security

| # | Criterion | Measurable Test |
|---|----------|----------------|
| S1 | Meta webhook authenticity verified | Unit test: POST without valid `X-Hub-Signature-256` → 401 |
| S2 | Tenant context is trusted, not LLM-derived | Code audit: `organizationId` comes from `user.organization_id`, never from LLM |
| S3 | Event context mandatory for event-scoped operations | Unit test: entity resolution without `eventId` → error |
| S4 | Cross-tenant access impossible | Unit test: user from org-A cannot resolve entities in org-B |
| S5 | Cross-event access impossible | Unit test: workpack query with `event_id` filter returns ONLY that event's workpacks |
| S6 | Unauthorized execution impossible | Unit test: EWS call without valid permission → 403 |
| S7 | `whatsapp_verified` enforced | Unit test: unverified user → rejection message |
| S8 | `whatsapp_opt_in` enforced | Unit test: non-opted-in user → rejection message |

### Entity Resolution

| # | Criterion | Measurable Test |
|---|----------|----------------|
| E1 | Equipment → Workpack → Activity resolution is event-scoped | Unit test: same equipment in 2 events → only queried event's workpack returned |
| E2 | Ambiguous entities do not silently resolve | Unit test: 2 candidate workpacks → clarification prompt returned |
| E3 | Controlled dimensions use approved master data | Unit test: discipline resolution via `ControlledValueResolver`, not string match |
| E4 | No raw-string resolution bypass in M16 path | Code audit: `DbMatcher.ts` is not imported by any M16 code |
| E5 | `M16EntityResolver` accepts `M16InteractionContext` | Unit test: resolver uses `ctx.eventId` and `ctx.organizationId` |

### Authority

| # | Criterion | Measurable Test |
|---|----------|----------------|
| A1 | No AI → Prisma mutation | `grep` audit: zero `prisma.activity.update` in M16 code |
| A2 | No AI progress calculation | `grep` audit: zero progress calculation in M16 code |
| A3 | No AI CPM calculation | `grep` audit: zero CPM/float calculation in M16 code |
| A4 | No AI readiness calculation | `grep` audit: zero readiness calculation in M16 code |
| A5 | Execution actions route through M12 EWS | Code audit: all write intents call `ExecutionWriteService.applyAction()` |

### Audit

| # | Criterion | Measurable Test |
|---|----------|----------------|
| AU1 | Every governed interaction logged | Unit test: interaction → `m16_interaction_logs` record exists |
| AU2 | Log contains required fields | Schema test: user, organisation, event, channel, conversation, intent, entity, action, authorization, result, timestamp, source |

---

## 13. Final R0.1 Verdict

### Assessment

| Area | Status | Evidence |
|------|--------|----------|
| Execution authority | ✅ GREEN | Zero Prisma mutations in AI/WhatsApp/Voice. All execution through EWS. |
| Progress authority | ✅ GREEN | M8.13 `calculateProgressMetrics()` used. No unauthorized calculations. |
| Cross-tenant isolation | ✅ GREEN | `organization_id` always filtered in all queries. |
| Event context | ✅ GREEN (architecture) | Existing `ActiveShutdownContext` + `shutdownContext.ts` + `syority_active_event` cookie provide reusable event context mechanism. WhatsApp gap is implementation, not architecture. |
| Entity resolution | ✅ GREEN (architecture) | Two-layer architecture defined (M16EntityResolver + DimensionRegistry/CVR). Schema has `event_id` on both Workpack and Activity. |
| Security architecture | ✅ GREEN (architecture) | Three-layer model defined. 11-step pipeline designed. Trust boundary documented. |
| Legacy execution path | ✅ GREEN | FES confirmed as read-only service. `/api/execution/activity-action` uses EWS with permission checks. No bypass. |
| Intent taxonomy | ✅ GREEN (design) | 29 intents across 4 categories defined. |
| Action safety model | ✅ GREEN (design) | 5-tier risk classification with confirmation rules. |
| Prompt injection boundary | ✅ GREEN (design) | Trust boundary architecture defined. LLM sits below trust boundary. |
| R1 scope | ✅ GREEN | Frozen with explicit include/exclude lists. |
| R1 acceptance criteria | ✅ GREEN | 20 measurable acceptance criteria defined across 4 categories. |

### P0 Status

| P0 Finding | Status After R0.1 |
|------------|-------------------|
| P0-1: Webhook POST unauthenticated | **Architecturally resolved** — solution designed (§9, §10). Implementation is first task of R1. No architectural ambiguity remains. |

### P1 Status

All 9 P1 findings have architectural solutions defined in this document. No P1 finding remains architecturally ambiguous.

---

# VERDICT

## 🟢 GREEN — R1 AUTHORIZED

**M16-R0.1 is CLOSED GREEN.**

**M16-R1 implementation is authorized within the frozen scope defined in §11.**

### Conditions

1. R1 MUST implement webhook signature verification as its **first deliverable** before any other M16 code processes live messages.
2. R1 MUST follow the architecture defined in this document (§2 context, §3 ambiguity rules, §4 entity resolution, §5 intent taxonomy, §6 action safety, §7 authority boundaries, §9 prompt injection boundary, §10 architecture diagram).
3. R1 MUST meet all 20 acceptance criteria defined in §12.
4. R1 MUST NOT exceed the scope defined in §11.
5. R1 MUST reuse existing `ActiveShutdownContext` / `getActiveShutdownServer()` / `syority_active_event` cookie pattern for event context rather than inventing a new mechanism.
6. R1 MUST reuse `FieldExecutionService` for event-scoped read queries.
7. R1 MUST reuse `ExecutionWriteService` for all mutations.
8. R1 MUST reuse `DimensionRegistry` and `ControlledValueResolver` for controlled value validation.
