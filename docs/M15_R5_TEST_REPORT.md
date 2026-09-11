# M15-R5 — Test Report

**Date:** 8 September 2026

Existing tests were not weakened or deleted. Assertions were not changed merely to achieve GREEN.

---

## New / extended tests

| File | Coverage |
|---|---|
| `src/core/m15/__tests__/m15-r5-hardening.test.ts` | A–E resolution, F–H journal append-only/audit/replay, S provenance, T 5k compose, identity spoof `authorizesExecution`, source scan |
| `src/core/m16/__tests__/m16-r5-m15-hardening.test.ts` | Conversation rec memory, intents, injection, combined accept+execute, eight-tool contract, writeTools = EWS |
| `src/core/m16/__tests__/m16-r4-m15-handoff.test.ts` | Extended: accept+execute, authorizesExecution text, skip confirmation, getRecommendation(Evidence) registration |

---

## Objective map

| ID | Topic | Evidence |
|---|---|---|
| A | Explicit id resolution | `resolveRecommendationReference` |
| B | Ambiguous HX-204 | ASK / `AMBIGUOUS` |
| C | Conversation “this” | unique last rec |
| D | Cross-event id | NOT_FOUND |
| E | Cross-tenant / spoof org | adapter envelope uses trusted org |
| F | Journal create | `m15_management_decisions.create` |
| G | Append-only | no update/delete; replay = second insert |
| H | Decision audit | `AuditService.log` |
| I | ACCEPT does not execute | no EWS in M15; handoff tests |
| J | ACCEPT does not authorize | `authorizesExecution=false` despite spoof true |
| K | Recommendation → execution separation | combined utterance blocked |
| L | Tool contracts | eight names; no Prisma/EWS in m15Tools |
| M | Prompt injection | ignore event context blocked |
| N | Identity spoofing | trusted userId required |
| O | Event spoofing | trusted eventId |
| P | Recommendation ID spoofing | other-event NOT_FOUND |
| Q | Replay | two creates |
| R | What-if isolation | R3 `ADDITIONAL_CREWS` NOT_SUPPORTED retained |
| S | Evidence provenance | sourceAuthority / asOf / compose model |
| T | Large recommendation sets | 5,000 compose |
| U | Performance | in-memory only → PERFORMANCE AMBER |
| V | Browser/API | API tests; browser infra missing → AMBER |
| W–Z | M15 R1–R4 regression | vitest `src/core/m15` |
| AA | M16 regression | vitest `src/core/m16` |
| AB | M12 EWS regression | `m12-r01-p0-remediation`, hold-resume, tenant-isolation |

---

## Run (8 September 2026)

```
npx vitest run src/core/m15 src/core/m16 src/core/execution/__tests__/m12-r01-p0-remediation.test.ts src/core/execution/__tests__/m12-hold-resume.test.ts src/core/execution/__tests__/m12-tenant-isolation.test.ts
```

**26 files, 558 tests, 0 failed.**

Focused M15+R4/R5 handoff+prompt-injection+R3 execution subset earlier: **9 files, 133 tests, 0 failed.**
