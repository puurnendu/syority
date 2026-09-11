# M16-R0 — Interaction Inventory

**Date:** 2026-09-07  
**Status:** VERIFIED AGAINST CODE — not inferred

---

## 1. WhatsApp Inbound Interactions (Implemented)

| # | User Message Example | Detected Intent | Entity Extraction | Resolution Method | Confidence Routing | Action | Authority |
|---|---------------------|----------------|-------------------|------------------|-------------------|--------|-----------|
| WI-1 | "HX-204 bundle pullout 50%" | `update` | unit, tag, desc, progress | GPT-4o Mini → JSON | ≥0.90 → auto-apply | UPDATE_PROGRESS via EWS | ✅ M12 |
| WI-2 | "HX-204 is done" | `update` | tag, progress=100 | GPT-4o Mini → JSON | ≥0.90 → auto-apply | COMPLETE via EWS | ✅ M12 |
| WI-3 | "What is the status of WP-034?" | `query` | keyword search | `handleQuery()` | N/A (query) | Read-only response | ⚠️ Direct DB |
| WI-4 | "Today's schedule" | `query` | keyword "schedule"/"today" | `handleQuery()` | N/A (query) | Read-only response | ⚠️ Direct DB |
| WI-5 | (voice note) | `update` or `query` | Whisper STT → text → WI-1/WI-3 | Same as text | Same as text | Same as text | Same as text |
| WI-6 | "2" (session reply) | session continuation | Session state lookup | pending_data candidates | Session-based | UPDATE_PROGRESS via EWS | ✅ M12 |
| WI-7 | "help" / "Hi" | `greeting` | None | Pattern match | N/A | Help menu text | N/A |

## 2. WhatsApp Outbound Interactions (Implemented)

| # | Trigger | Template | Language Support | Channel |
|---|---------|----------|------------------|---------|
| WO-1 | Auto-update confirmed | `ReplyBuilder('confirmed')` | en, hi, gu, ta, ml | WhatsApp text |
| WO-2 | Disambiguation needed | `ReplyBuilder('ask_activity')` | en, hi, gu, ta, ml | WhatsApp text |
| WO-3 | Unit not found | `ReplyBuilder('ask_unit')` | en, hi, gu, ta, ml | WhatsApp text |
| WO-4 | Tag not found | `ReplyBuilder('tag_not_found')` | en, hi, gu, ta, ml | WhatsApp text |
| WO-5 | Low confidence → parked | `ReplyBuilder('parked')` | en, hi, gu, ta, ml | WhatsApp text |
| WO-6 | Query result | Free-form text | en only | WhatsApp text |
| WO-7 | Planner approved | `ReplyBuilder('confirmed')` | User's detected language | WhatsApp text |
| WO-8 | Planner rejected | Rejection template with notes | en, hi, gu, ta, ml | WhatsApp text |
| WO-9 | Shift report | AI-generated summary | en only | WhatsApp text + Email |

## 3. Web AI Chat Interactions (Implemented)

| # | User Message Example | Processing | Data Source | Authority |
|---|---------------------|-----------|-------------|-----------|
| AC-1 | "What are the top schedule risks?" | AI inference from system prompt | M8.13 calculateProgressMetrics + DB counts | ✅ Authoritative input |
| AC-2 | "Which activities are on the critical path?" | AI inference from system prompt | `activity.count(is_critical)` | ✅ DB read |
| AC-3 | "Summarise open constraints by impact" | AI inference from system prompt | `project_constraints.count(status: Open)` | ✅ DB read |
| AC-4 | "What should the team prioritise today?" | AI inference from system prompt | System prompt context | ⚠️ AI inference only |

**NOTE:** AI chat is READ-ONLY. Cannot execute commands.

## 4. WhatsApp Management UI Interactions (Implemented)

| # | User Action | API Route | Permission | Write? |
|---|------------|-----------|------------|--------|
| MU-1 | View pending updates | `GET /api/whatsapp/updates?status=parked_review` | `workpacks.view` | No |
| MU-2 | View all updates | `GET /api/whatsapp/updates` | `workpacks.view` | No |
| MU-3 | View update details | `GET /api/whatsapp/updates/[id]` | `workpacks.view` | No |
| MU-4 | Approve update | `POST /api/whatsapp/updates/[id]/approve` | `workpacks.edit` | Yes → EWS |
| MU-5 | Reject update | `POST /api/whatsapp/updates/[id]/reject` | `workpacks.edit` | Yes → status only |
| MU-6 | View update count | `GET /api/whatsapp/updates/count` | `workpacks.view` | No |
| MU-7 | Play audio recording | `GET /api/whatsapp/audio/[id]` | — | No |

## 5. Cron/Automated Interactions (Implemented)

| # | Trigger | Service | Output | Schedule |
|---|---------|---------|--------|----------|
| CR-1 | Cron POST to `/api/cron/shift-reports` | `ShiftReportGenerator.generateShiftReports()` | WhatsApp + Email reports | External cron (day/night) |
| CR-2 | Cron POST to `/api/cron/notification-digest` | `NotificationQueueProcessor.processQueue()` | Email notifications | External cron |

## 6. AI Workpack Generation Interactions (Implemented)

| # | User Action | Service | AI Job | Output |
|---|------------|---------|--------|--------|
| WG-1 | Create workpack with AI | `AiWorkpackGenerator.generateWorkpack()` | `workpack_generation` | JSON: activities, materials, constraints, blinds, QA |
| WG-2 | Extract from P&ID | `PAndIdExtractor.extractFromPAndId()` | `document_vision` | JSON: tag numbers, pipe sizes, connections |
| WG-3 | Extract doc parameters | `DocumentParameterExtractor.extract()` | `document_parameter_extraction` | JSON: engineering parameters |
| WG-4 | Suggest lessons | `LessonsSuggester.suggest()` | `lessons_suggestion` | JSON: relevant past lessons |

## 7. NOT IMPLEMENTED — Required for M16

| # | Interaction | Channel | Intent | Rationale |
|---|------------|---------|--------|-----------|
| NI-1 | "Start HX-204 bundle pullout" | WhatsApp/Voice/Web | `command.start` | ExecutionAction START exists in EWS |
| NI-2 | "Hold HX-204 — waiting for parts" | WhatsApp/Voice/Web | `command.hold` | ExecutionAction HOLD exists in EWS |
| NI-3 | "Resume HX-204" | WhatsApp/Voice/Web | `command.resume` | ExecutionAction RESUME exists in EWS |
| NI-4 | "Report delay on HX-204: 4 hours, material shortage" | WhatsApp/Voice/Web | `command.report_delay` | ExecutionAction REPORT_DELAY exists in EWS |
| NI-5 | "Show me the daily progress report" | WhatsApp/Web | `query.report` | M14 exists but not wired |
| NI-6 | "What constraints are blocking CDU?" | WhatsApp/Web | `query.constraints` | Data exists, not queryable via WhatsApp |
| NI-7 | "Show my activities for today" | WhatsApp/Web | `query.my_activities` | Data exists, not queryable via WhatsApp |
| NI-8 | "Upload photo of completed work" | WhatsApp | `command.attach_evidence` | Photo capability not implemented |
| NI-9 | Voice commands via browser mic | Web | All | No browser STT |
| NI-10 | "Create a workpack for..." | Web AI Chat | `command.create_workpack` | AI chat is read-only |
| NI-11 | Multi-turn conversation memory | All | All | No server-side conversation state for web AI |

## 8. Interaction Coverage Matrix

| ExecutionAction | Web UI | WhatsApp | Voice | AI Chat | Mobile |
|-----------------|--------|----------|-------|---------|--------|
| START | ✅ | ❌ | ❌ | ❌ | ❌ |
| UPDATE_PROGRESS | ✅ | ✅ | ✅ (via WA) | ❌ | ❌ |
| COMPLETE | ✅ | ✅ | ✅ (via WA) | ❌ | ❌ |
| HOLD | ✅ | ❌ | ❌ | ❌ | ❌ |
| RESUME | ✅ | ❌ | ❌ | ❌ | ❌ |
| RELEASE | ✅ | ❌ | ❌ | ❌ | ❌ |
| VERIFY | ✅ | ❌ | ❌ | ❌ | ❌ |
| CLOSE | ✅ | ❌ | ❌ | ❌ | ❌ |
| REPORT_DELAY | ✅ | ❌ | ❌ | ❌ | ❌ |
| Query status | ✅ | ✅ | ✅ (via WA) | ✅ | ❌ |
| Query schedule | ✅ | ✅ (limited) | ✅ (via WA) | ✅ | ❌ |
| View report | ✅ | ❌ | ❌ | ❌ | ❌ |
