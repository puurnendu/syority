# M15-R5 — Architecture

**Date:** 8 September 2026  
**Status:** M15 CLOSED (final core milestone). No M15-R6.

---

## Protected stack

| Layer | Authority |
|---|---|
| M8.13 | Actual progress / SPI aggregation |
| M10 / M12 | Planning / execution readiness (as already defined) |
| M11 | CPM / schedule / calendar / dependency / baseline |
| M8.9 | Schedule scenario (hypothetical) |
| M8.10 | EVM / cost forecast |
| M8.8 | Forecast / health intelligence (cited) |
| M12 EWS | Execution mutation |
| M13 | Operational exceptions |
| M14 | Reporting datasets |
| **M15** | Management decision intelligence + journal |
| **M16** | Conversation / governed action interface |

M15 answers: problem, why it matters, evidence, what management should consider, qualitative consequence, supported what-if.

M15 does not execute, mutate Activity/Workpack execution state, calculate progress/CPM/readiness/SPI, create operational exceptions, authorize execution, or bypass M16 confirmation.

---

## Four boundaries (must never collapse)

```
RECOMMENDATION        ≠  MANAGEMENT DECISION
MANAGEMENT DECISION   ≠  EXECUTION REQUEST
EXECUTION REQUEST     ≠  EXECUTION
```

ACCEPT records a journal row with `authorizesExecution=false`.  
A later “start the bundle pullout” is an independent M16 intent → entity resolve → authorization → readiness → ConfirmationGate → EWS.

“Accept it and execute it” does not EWS. The utterance is treated as ambiguous recommendation-execution language.

---

## R5 hardening (not a new intelligence layer)

- Deterministic conversational reference resolution against the trusted event set
- Conversation memory of **application-returned** recommendation ids only
- Journal identity: LLM cannot set org/event/user/`authorizesExecution`
- `getRecommendation` / `getRecommendationEvidence` registered (no first-match guess)
- Decision history on the management-intelligence panel (GET journal, not EWS)
- Injection patterns for event-context override

What-if kinds are unchanged from R3: supported `DURATION_SLIP`, `DURATION_CHANGE`, `DELAYED_START`, `RESOURCE_LEVELING_SIMULATION`; unsupported `ADDITIONAL_CREWS`, `CONSTRAINT_REMOVAL`, `SCOPE_CHANGE` → `NOT_SUPPORTED`.

---

## Data flow

```
USER
 → M16 (trusted session org/event/user)
 → m15Tools (ignore spoofed identity)
 → m15ToToolResult
 → DecisionIntelligenceService
 → cite M13/M11/M12/M8.*  OR  ManagementDecisionService.create
 → Prisma journal only for decisions
```

Execution:

```
USER
 → M16 write intent
 → ConfirmationGate (when required)
 → writeTools
 → ExecutionWriteService.applyAction
```
