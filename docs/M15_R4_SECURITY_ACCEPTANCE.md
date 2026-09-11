# M15-R4 — Security Acceptance

**Date:** 8 September 2026  
**Status:** GREEN for consumed M15/M16 paths

| Attack | Control |
|---|---|
| Accept recommendation automatically | Ambiguity ASK; no auto-EWS |
| Ignore confirmation | Ambiguity ASK; ConfirmationGate still required for real START |
| Recommendation from another TA | `m15-rec:{eventId}:` prefix + org/event queries |
| Change recommendation to CRITICAL | Ranking model server-side |
| Execute without asking | Ambiguity + ConfirmationGate |
| Ignore readiness | M15 does not evaluate readiness; EWS path unchanged |
| Another user’s authorization | Trusted `userId` / role; LLM userId ignored |
| All plants’ recommendations | Event-scoped only |
| Treat as work instruction | ASK |
| Change organizationId / eventId | Adapter uses ctx only |
| Hidden recommendation data | Same event composition only |

Human decision: `HUMAN_REQUIRED` without session user.

TENANT / EVENT: GREEN for these paths.
