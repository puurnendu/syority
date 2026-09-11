# M16-R6 — Final Authority Matrix

**Date:** 8 September 2026

M16 is an interaction and orchestration layer. It must not become a second source of truth.

| Domain | Authority | M16 role | Direct mutation allowed? |
|---|---|---|---|
| Identity | Auth/session, WhatsApp phone lookup | consume | No |
| Tenant | Application context (`organizationId` from identity) | consume | No |
| Event | Application context / EventContextResolver | resolve/consume | Session event_id write only (WhatsApp), not domain |
| Entity | DimensionRegistry / `M16EntityResolver` | resolve (read) | No |
| Progress | M8.13 `ProgressCalculationService` / `ProgressAggregationService` | retrieve/explain | No |
| CPM / planned schedule | M11 schedule engine / orchestration | retrieve/explain via FieldExecution/Control Tower | No |
| Readiness | M12 `ExecutionReadinessService` (constraints, predecessors, permits) | retrieve | No |
| Execution | M12 `ExecutionWriteService` | invoke | Through EWS only for named actions. Planning CRUD remains a P2 column-level exception (not M16). |
| Authorization | RBAC / R3 `checkAuthorization` | enforce | No LLM decision |
| Risk | R3 `classifyRisk` (deterministic) | enforce | No LLM decision |
| Confirmation | R3 `ConfirmationGate` (conversational); tactile UI on Mobile/Web | enforce | No channel-specific duplicate gate |
| Reporting | M14 | retrieve/request | No |
| Control Tower | M13 query service | retrieve/explain | No |
| Interaction audit | `m16_interaction_logs` | record governance trail | Class B write only |
| Business audit | `AuditService` inside EWS transaction | record mutations | Via EWS only |

### Parallel non-M16 surfaces (not second authorities)

| Surface | Role | Mutation |
|---|---|---|
| `app/api/projects/[id]/ai-assistant` | Planning chat; injects M8.13 metrics as context | None (stream) |
| Planner WhatsApp approve | Human review of extracted progress | EWS `UPDATE_PROGRESS` |
| Excel bulk upload | Operator import | `EWS.bulkApplyAction` |
| Web execution APIs | Operator UI | EWS |

### Architecture (actual)

```
 WEB ──┐
WA    ─┼─► M16 Interaction Core ─► Intent / Entity / Context
VOICE ─┤                              │
MOBILE─┘                         Authorization (R3)
                                      │
                                 Risk Gate (R3)
                                      │
                         ConfirmationGate (conversational)
                         or tactile confirm (Mobile/Web)
                                      │
                              R3 writeTools / Mobile adapter
                                      │
                                      EWS
                                      │
                         AuditLog ◄───┼───► EventBus
                                      │
                                 M12 Execution
                                      │
                         M8.13     M11     ExecutionReadiness
                        Progress   CPM     (M12/M10 permits)
```

Mobile direct execute does **not** go through writeTools; it calls EWS after the same R3 authorization/risk functions. That is one execution authority, two invocation adapters.
