# M15-R1 — Security Acceptance

**Date:** 8 September 2026  
**Status:** GREEN for consumed M15 paths, with documented permission and unused-engine debt.

---

## 1. Authentication

HTTP routes wrap `withTenantGuard`:

- No session → **401**
- No `organization_id` → **403**

Then `guardApi('nav.schedule')` (401 if unauthenticated; 403 if role lacks permission). Platform super-admin bypass is the existing `guardApi` behavior, not an M15 invention.

Tests: route source must include both guards; `withTenantGuard` contains the 401 branch.

---

## 2. Tenant isolation

| Check | Result |
|---|---|
| Org from session only | Yes |
| Body `organizationId` rejected as unused | Routes do not read it |
| Org A cannot resolve Org B event | `assertEventScope` + `EVENT_NOT_FOUND` |
| UUID substitution of event/activity/scenario | Lookups include `organization_id` **and** `event_id` |

---

## 3. Event isolation

| Check | Result |
|---|---|
| Event never inferred from org alone | Missing `eventId` → `EVENT_REQUIRED` |
| Event A cannot load Event B activity (same org) | `activity.findFirst` includes `event_id` |
| Identical tags/names | Lookup is UUID, not `activity_number` / description |
| ConstraintLog without `event_id` | Scoped through workpack event |
| CP relationships | Predecessor/successor event-scoped |
| Scenario relationships | Event-scoped |
| Scenario finish forecast | `scheduleScenario` filtered by org+event |
| `bre_alerts` | Not queried |

No `EventMember` table exists. Event access = event belongs to the user’s organization.

---

## 4. Authorization / permission

**Decision:** `nav.schedule`.

No `intelligence.*` permission exists. Inventing a new permission that nobody has would lock out legitimate schedule readers; inventing a bypass would be worse. `nav.schedule` is the existing schedule-intelligence gate.

POST impact-scenario uses the same permission as `POST .../schedule/scenarios`.

---

## 5. AI / LLM

| Attack | Control |
|---|---|
| LLM supplies org/event | Adapter and HTTP ignore transcript; trusted ctx / session only |
| LLM supplies risk score | No LLM scoring path exists |
| LLM decides confirmation | M15 does not import `ActionRiskLevel` or confirmation logic |
| `runImpactScenario` without session user | Adapter returns `DENIED` |

M16 must pass frozen application context into `m15ToToolResult`. R1 does not register WhatsApp/voice tools.

---

## 6. Write surface

M15 HTTP GET is read-only.

POST `/management/impact` writes **scenario store only** (M8.9). It does not:

- mutate live `Activity` CPM
- call EWS
- call leveling apply
- start/complete work

---

## 7. Residual security debt (P2)

- Unused `bre_alerts` still lack `event_id` (other products).
- Unused `ScopeChangeImpactService` baseline lookup still org-only.
- `getScenario(id, org)` still omits event (not on M15 forecast path).
- Future dedicated intelligence permission not added.
