# M15-R3 — Evidence Model

**Date:** 8 September 2026

R3 **does not introduce a second evidence engine**. Recommendations reuse R2 `IntelligenceEvidence` on the source `ManagementRisk`.

---

## Rule

No recommendation without evidence unless `status = INSUFFICIENT_EVIDENCE`.

Each evidence item still identifies:

- `sourceAuthority` (M13, M11, M8.13, M8.10, M15, …)
- entity (`entityType` / `entityId`)
- `metric` + `value`
- `layer` (FACT / CALCULATION / INTELLIGENCE / RECOMMENDATION)
- optional `sourceService` / `sourceRecord` / `explanation`
- as-of via the parent recommendation `asOf`

Example (schedule):

```
sourceAuthority: M13
metric: exception_code
value: CRITICAL_LATE
layer: FACT
entity: activity ACT-…
```

Example (readiness, via M13 exception that consumed M12):

```
exceptionCode: READINESS_BLOCKED
sourceAuthority: M13
```

M15 still does not call `ExecutionReadinessService` itself.

---

## Layers vs recommendation text

| Layer | Meaning |
|---|---|
| FACT | Persisted/detected value from an authority |
| CALCULATION | Authoritative computed metric (SPI, float, forecast date) |
| INTELLIGENCE | Management priority score |
| RECOMMENDATION | CONSIDER wording — not a fact |

UI badges make the same distinction. Scenario results are labelled hypothetical, not FACT.

---

## Forbidden

- Invented confidence percentages
- Treating downstream **activity count** as slip **hours**
- Evidence from another event/org
- LLM-supplied evidence or priority
