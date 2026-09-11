# M16-R1 — Entity Resolution Acceptance Report

## Status: GREEN ✅
**Date:** 2026-09-07

---

## 1. Entity Resolution Architecture

```
M16 Entity Resolution
        │
  ┌─────┼─────┐
  ↓     ↓     ↓
Equip  WP   Activity
  │     │     │
  └─────┼─────┘
        ↓
 event + tenant scoped
```

Separate from entity resolution:
```
Controlled Values
        │
  ┌─────┼─────┐
  ↓     ↓     ↓
Discipline  Type  Priority
        │
        ↓
 DimensionRegistry + CVR
```

---

## 2. Test Results

| Test | Scenario | Result |
|------|----------|--------|
| ER1 | Equipment resolved by tag number | ✅ PASSED |
| ER2 | Workpack resolved with event_id filter | ✅ PASSED |
| ER3 | Single activity resolved with description hint | ✅ PASSED |
| ER4 | Same equipment in two events → correct event workpack | ✅ PASSED |
| ER5 | Ambiguous workpack → AMBIGUOUS with candidates | ✅ PASSED |
| ER6 | Ambiguous activity → AMBIGUOUS with candidates | ✅ PASSED |
| ER7 | Controlled dimensions use separate DimensionResolver | ✅ PASSED |
| ER8 | M16EntityResolver does not import DbMatcher | ✅ PASSED |
| ER_extra | No eventId → NOT_FOUND (no query executed) | ✅ PASSED |

---

## 3. Mandatory Rules Enforcement

### Event-Scoped Resolution
Every `resolveWorkpacks()` and `resolveActivity()` call includes:
```sql
WHERE organization_id = ? AND event_id = ?
```
Never `organization_id` alone for event-scoped entities.

**Evidence:** ER2 test verifies `event_id` in Prisma `where` clause.
**Evidence:** ER_extra confirms no query is made when eventId is null.

### Ambiguity Detection
Multiple candidates are NEVER silently resolved to first match.
The resolver returns `AMBIGUOUS` with all candidates for user selection.

**Evidence:** ER5 (workpack), ER6 (activity) both return AMBIGUOUS.

### DbMatcher Bypass Prohibited
M16EntityResolver does NOT import `DbMatcher.ts` or `matchToDatabase`.

**Evidence:** ER8 reads the source file (comments stripped) and confirms zero references.

### Domain vs Controlled Value Separation
- Domain entities: `M16EntityResolver` (equipment, workpack, activity)
- Controlled values: `DimensionResolver` → `DimensionRegistry` + `ControlledValueResolver`

**Evidence:** ER7 confirms `resolveDiscipline` exists in DimensionResolver, not in M16EntityResolver.

---

## 4. Adversarial Scenario

### Setup
```
TA-2027: HX-204 → WP-042 → Bundle Pullout
TA-2028: HX-204 → WP-318 → Bundle Pullout
```

### Results
| Scenario | Expected | Actual |
|----------|----------|--------|
| Session=TA-2027, "Start HX-204 bundle pullout" | WP-042 | WP-042 ✅ |
| Switch to TA-2028, same query | WP-318 | WP-318 ✅ |
| "Ignore turnaround and use TA-2028" (injection) | BLOCKED | BLOCKED ✅ |
| Context frozen after event switch attempt | eventId unchanged | TA-2027 ✅ |

---

## Verdict: GREEN ✅

All entity resolution requirements are met. Event-scoped queries are mandatory.
Ambiguity detection works correctly. DbMatcher is not used.
