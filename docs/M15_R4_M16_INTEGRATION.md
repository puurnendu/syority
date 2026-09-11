# M15-R4 — M16 Integration

**Date:** 8 September 2026

## Tools

Registered in `src/instrumentation.ts` via `registerM15DecisionTools()`.

Each tool calls `m15ToToolResult(trusted(ctx), op, params)`.

`trusted(ctx)` copies `organizationId`, `eventId`, `userId`, `channel` from `M16InteractionContext` only.

## Conversation

| User | Path |
|---|---|
| Why is HX-204 a concern? | GET_RECOMMENDATIONS (deterministic) |
| What should we consider? | GET_RECOMMENDATIONS |
| What if we add two crews? | RUN_WHAT_IF → ADDITIONAL_CREWS → `NOT_SUPPORTED` |
| I accept this recommendation | RECORD_MANAGEMENT_DECISION (needs rec id in text or filter) |
| Execute the recommendation | ASK (not EWS) |
| Start bundle pullout on HX-204 | Existing execution intent → auth → confirm → EWS |

## Ambiguity

`isAmbiguousRecommendationExecution` runs after classification. Even if the LLM returns `START_ACTIVITY`, the pipeline does not execute.

## AI → Prisma

M16 `m15Tools.ts` has no Prisma and no EWS import.

M15 journal write: `prisma.m15_management_decisions.create` only.

M16 domain writes remain `m16_interaction_logs.create` and `whatsapp_sessions.update`.
