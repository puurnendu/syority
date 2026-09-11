# M16-R0 — Architecture Recommendation

**Date:** 2026-09-07  
**Status:** RECOMMENDATION ONLY — no implementation

---

## 1. Proposed M16 Architecture

```
                    ┌─────────────┐
                    │  Web Chat   │
                    │  (Browser)  │
                    └──────┬──────┘
                           │
        ┌──────────┐       │       ┌──────────────┐
        │ WhatsApp │───────┼───────│    Mobile     │
        │  Webhook │       │       │  (Future)     │
        └──────────┘       │       └──────────────┘
                           │
                    ┌──────┴──────┐
                    │   Channel   │
                    │  Adapter    │
                    │  Layer      │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   M16       │
                    │  Intent     │
                    │  Engine     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────┴──────┐ ┌──┴───┐ ┌──────┴──────┐
       │   Entity    │ │ Auth │ │  Dimension  │
       │  Resolver   │ │ Gate │ │  Registry   │
       └──────┬──────┘ └──┬───┘ └──────┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴────┐ ┌────┴────┐ ┌─────┴────┐
        │  Query   │ │ Command │ │  Report  │
        │  Handler │ │ Handler │ │  Handler │
        └─────┬────┘ └────┬────┘ └─────┬────┘
              │            │            │
              │     ┌──────┴──────┐     │
              │     │   EWS       │     │
              │     │ (M12)       │     │
              │     └──────┬──────┘     │
              │            │            │
   ┌──────────┼────────────┼────────────┼──────────┐
   │          │            │            │          │
   ▼          ▼            ▼            ▼          ▼
 M8.13      M10          M11         M13        M14
Progress  Readiness    Schedule    Control     Reporting
                                   Tower
```

## 2. Core Principles

### 2.1 Channel Adapter Pattern

Every input channel (Web, WhatsApp, Voice, Mobile) MUST be a thin adapter that:
- Authenticates the user
- Extracts raw input (text, audio → text)
- Passes to the unified M16 Intent Engine
- Formats the response for the channel

Adapters MUST NOT:
- Call domain services directly
- Query the database
- Perform entity resolution
- Make authorization decisions

### 2.2 Intent Engine

The M16 Intent Engine is the single entry point for all interaction processing:

```typescript
interface M16IntentResult {
  intent: M16Intent;
  entities: M16Entity[];
  confidence: number;
  requiresConfirmation: boolean;
  suggestedAction?: M16Action;
}

type M16Intent =
  | 'query.status'          // "What is the progress of HX-204?"
  | 'query.schedule'        // "Show today's lookahead"
  | 'query.constraints'     // "What constraints are on CDU?"
  | 'query.my_activities'   // "What are my jobs today?"
  | 'query.report'          // "Send me the daily report"
  | 'command.update_progress' // "HX-204 bundle pullout 50%"
  | 'command.start'         // "Start HX-204 bundle pullout"
  | 'command.complete'      // "HX-204 bundle pullout is done"
  | 'command.hold'          // "Hold HX-204 - waiting for parts"
  | 'command.resume'        // "Resume HX-204"
  | 'command.report_delay'  // "HX-204 is delayed 4 hours"
  | 'conversation.help'     // "Help"
  | 'conversation.greeting' // "Hello"
  | 'conversation.unknown'; // Unrecognized
```

### 2.3 Entity Resolution via DimensionRegistry

All entity resolution MUST use the authoritative `DimensionRegistry` and `ControlledValueResolver`:

```
AI/WhatsApp extracts: "HX-204", "bundle pullout", "CDU", "mechanical"
     ↓
M16 Entity Resolver
     ↓
DimensionRegistry.resolve("HX-204") → Asset { id, tag_number, unit_id, equipment_type_id }
ControlledValueResolver.resolveDiscipline(orgId, "mechanical") → { code: "MECH", label: "Mechanical" }
DimensionRegistry.resolve("CDU") → Unit { id, name, code }
Activity.match("bundle pullout", asset_id) → Activity { id, description }
```

### 2.4 Authorization Gate

Every M16 command MUST pass through:

```
Channel Adapter → Intent Engine → Authorization Gate
     ↓
   User Identity (session or phone→user)
   Permission Check (role-based)
   Tenant Scope (organization_id)
   Event Scope (event_id)
   Confirmation Gate (for destructive actions)
     ↓
   Domain Service
```

### 2.5 Query vs Command Separation

| Type | Authorization | Confirmation | Audit | EventBus |
|------|--------------|--------------|-------|----------|
| Query | Read permission | Never | Optional | Never |
| Command | Write permission | Required for COMPLETE, HOLD, CLOSE | Always | Always via EWS |

## 3. Component Mapping to Existing Services

| M16 Component | Existing Service | Reuse Strategy |
|---------------|-----------------|----------------|
| Channel Adapter - WhatsApp | `MessageProcessor` | Refactor to thin adapter calling Intent Engine |
| Channel Adapter - Web | `AIAssistantPanel` | Rebuild with function calling |
| Intent Engine | `FieldExtractor` | Replace with structured intent + entity schema |
| Entity Resolver | `DbMatcher` | Replace with DimensionRegistry wrapper |
| Command Handler | `applyProgressUpdate()` | Already delegates to EWS — generalize |
| Query Handler | `QueryHandler` | Rebuild to use authoritative services |
| Report Handler | Stub in `reportDeliveryWorker` | Wire to M14 ReportGenerationService |
| AI Provider | `ProviderLoader` / `universalAiClient` | Reuse as-is |
| Prompt Management | `AiPromptService` | Extend with M16 intent prompts |
| Audio Processing | `AudioProcessor` | Reuse as-is |
| Reply Building | `ReplyBuilder` | Extend with new intents |

## 4. Schema Recommendations

### Required Schema Changes (M16-R1)

```prisma
// Make organization_id non-nullable
model whatsapp_sessions {
  organization_id String @db.Uuid  // Remove nullable
  event_id        String? @db.Uuid // ADD: event scoping
}

model whatsapp_updates {
  organization_id String @db.Uuid  // Remove nullable
  event_id        String? @db.Uuid // ADD: event scoping
}

// NEW: Conversation model for multi-turn
model m16_conversations {
  id              String   @id @default(uuid()) @db.Uuid
  organization_id String   @db.Uuid
  event_id        String?  @db.Uuid
  user_id         String   @db.Uuid
  channel         String   // web | whatsapp | mobile | voice
  started_at      DateTime @default(now())
  last_activity   DateTime @default(now())
  state           String   @default("active")
  context         Json?    // Resolved entities, conversation memory
  expires_at      DateTime
}

// NEW: Interaction log for audit
model m16_interaction_logs {
  id              String   @id @default(uuid()) @db.Uuid
  conversation_id String?  @db.Uuid
  organization_id String   @db.Uuid
  user_id         String?  @db.Uuid
  channel         String
  direction       String   // inbound | outbound
  intent          String?
  entities        Json?
  raw_input       String?
  processed_input String?
  response        String?
  action_taken    String?
  confidence      Float?
  latency_ms      Int?
  created_at      DateTime @default(now())
}
```

## 5. Security Recommendations

### P0 — Implement Before M16-R1

1. **WhatsApp Webhook Signature Verification**
   - Verify `X-Hub-Signature-256` header against WHATSAPP_APP_SECRET
   - Reject all unsigned requests

### P1 — Implement During M16-R1

2. **WhatsApp Confirmation for Destructive Actions**
   - COMPLETE: "Are you sure you want to mark HX-204 bundle pullout as complete? Reply YES to confirm."
   - HOLD: Require reason text before applying
   
3. **Non-nullable Organization ID**
   - Migrate `whatsapp_sessions.organization_id` to non-nullable
   - Migrate `whatsapp_updates.organization_id` to non-nullable

4. **AI Chat Audit Logging**
   - Log every AI chat interaction to `m16_interaction_logs`

## 6. Authority Boundary Enforcement

### M16 MUST NOT:

```
❌ AI → prisma.activity.update()
❌ AI → prisma.workpack.update()
❌ AI → raw SQL
❌ WhatsApp → prisma.activity.update()
❌ MessageProcessor → direct activity write
❌ AI → calculateProgressMetrics() for STORAGE
❌ AI → CPM calculation
❌ AI → schedule modification
```

### M16 MUST:

```
✅ AI → Intent Engine → Authorization → ExecutionWriteService
✅ AI → Intent Engine → Query Handler → Authoritative Service → Read-only response
✅ WhatsApp → Channel Adapter → Intent Engine → ExecutionWriteService
✅ Voice → STT → Channel Adapter → Intent Engine → ExecutionWriteService
```

## 7. Implementation Priority

| Priority | Item | Rationale |
|----------|------|-----------|
| 1 | Webhook auth (P0) | Security blocker |
| 2 | Intent Engine core | Foundation for all channels |
| 3 | DimensionRegistry entity resolution | Replaces fragile string matching |
| 4 | AI function calling | Enables authoritative data access |
| 5 | Conversation memory | Enables multi-turn interactions |
| 6 | M14 report delivery integration | Eliminates ShiftReport duplication |
| 7 | Voice input (browser STT) | New capability |
| 8 | Mobile channel | New capability |
