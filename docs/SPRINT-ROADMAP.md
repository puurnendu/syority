# AURIANOA OS / SYORITY — Full Sprint Roadmap

**Source:** Derived from `FEATURE_SPEC_v1.md`, `PHASE-1-IMPLEMENTATION-ROADMAP.md`, codebase route audit, and 3-layer governance architecture.
**Sprint cadence:** 2-week sprints.
**Last updated:** 2026-05-03

---

## ✅ Sprints 1–5 (COMPLETED)

| Sprint | Theme | Deliverables |
|---|---|---|
| **1** | Foundation Services | AuditService, EventBus, ConsumableService, NotificationService |
| **2** | Form & Document Engines | FormTemplateService, FormInstanceService, DocumentInstanceService, AttachmentService |
| **3** | PDF Generation | PdfService (Puppeteer), GenerateWorkpackPdf BullMQ job, PDF template component |
| **4** | Scheduling Export/Import | ActivityUdfService, ActivityLibraryService, ScheduleExportService, P6XmlFormatter, ScheduleImportService |
| **5** | AI Extraction Pipeline | AiManager, AnthropicDriver, AiExtractionService, AiCatalogMatchingService, AiWorkpackBuilderService |

---

## ✅ Sprint 6 — Platform & Tenant Governance (COMPLETED)

> 3-layer architecture, route guard enforcement, nav segregation, UI/UX fixes

- `requirePlatformContext()` / `requireDataAdminContext()` server guards on all layouts
- `/platform-data/*` namespace — layout, landing page, breadcrumb, full nav array (10 links)
- `ContextPill` component: proxy mode indicator (amber), Platform (blue), Master Data (purple), Tenant (grey)
- Exit Proxy button with `POST /api/proxy/exit` wired to `/platform/tenants` redirect
- `GlobalBreadcrumb` across all three layout shells
- Role-aware logo href (`/platform/tenants` for platform admins, `/dashboard` for tenants)
- `showNotifications={false}` in platform/platform-data layouts (no tenant scope)
- Cross-nav: full `platformDataItems` array in `platform/layout.tsx` — platform admins can reach all Master Data sections without typing URLs
- Visual nav divider between execution and admin/config groups
- `UserMenu` role badge + proxy mode highlight
- Breadcrumb label collision fix: `platform-data` → `"Platform Data"` (was `"Master Data"`)
- Mobile drawer: dynamic `platformName`, role-aware home link

---

## Sprint 7 — Workpack Lifecycle Hardening

**Theme:** Close gaps in the core workpack state machine and submission flow

| # | Feature | Route(s) |
|---|---|---|
| 7.1 | Workpack approval workflow — submit / approve / reject with comments | `POST /api/workpacks/[id]/submit`, `/approve`, `/reject` |
| 7.2 | WorkpackVersion auto-snapshot on status change | `WorkpackVersionService` |
| 7.3 | Workpack next-number auto-increment per site/event/equip-type | `GET /api/workpacks/next-number` |
| 7.4 | Workpack clone | `POST /api/workpacks/[id]/clone` |
| 7.5 | Full audit trail tab per workpack | `GET /api/workpacks/[id]/audit` |
| 7.6 | Workpack summary-counts badge API | `GET /api/workpacks/[id]/summary-counts` |

---

## Sprint 8 — Materials, Tools & SAP Sync

**Theme:** Complete the BOM and tooling flow end-to-end

| # | Feature | Route(s) |
|---|---|---|
| 8.1 | Materials tab — full CRUD with item catalog lookup | `/api/workpacks/[id]/materials/*` |
| 8.2 | Gasket/bolt auto-lookup when joint added | `POST /api/workpacks/[id]/materials/auto-fill-gaskets` |
| 8.3 | Material status workflow (requested → reserved → issued → returned) | PATCH `status` field |
| 8.4 | Tools tab — CRUD + calibration cert expiry tracking | `/api/workpacks/[id]/tools/*` |
| 8.5 | SAP sync — push BOM to SAP for material reservation | `POST /api/workpacks/[id]/sap-sync` |
| 8.6 | Material shortage dashboard (event-wide roll-up) | `/events/[eventId]/materials` |

---

## Sprint 9 — Checklists, Clearance & Hold Points

**Theme:** Dropping/Box-up checklists + QA clearance sign-off

| # | Feature | Route(s) |
|---|---|---|
| 9.1 | Dropping checklist tab — template-driven, per-item sign-off | `/api/workpacks/[id]/checklists/*` |
| 9.2 | Box-up checklist tab — completion gate (blocks state progress) | same |
| 9.3 | Cleaning records | `/api/workpacks/[id]/cleaning` |
| 9.4 | Hold-point definition (witness / surveillance / hold) | `QaClearanceRecord` model |
| 9.5 | Multi-party clearance sign-off (client, EPC, vendor, HSE, ops) | `POST /api/workpacks/[id]/clearance-boxup/sign-off` |
| 9.6 | Waiver workflow (reason + authoriser + expiry) | PATCH endpoint |
| 9.7 | Clearance party library (org-level) | `/api/admin/clearance-parties` |

---

## Sprint 10 — Job Completion Certificates (JCC)

**Theme:** Certificate generation, template designer, PDF signing

| # | Feature | Route(s) |
|---|---|---|
| 10.1 | JCC auto-generation on mechanical complete | `POST /api/workpacks/[id]/jcc/generate` |
| 10.2 | Certificate template designer (field types: text, number, date, bool, image, signature) | `/settings/certificate-templates/[id]` |
| 10.3 | Certificate instance + countersign workflow | `/api/workpacks/[id]/certificates/*` |
| 10.4 | PDF generation + QR code for cert verification | `GET /api/workpacks/[id]/certificates/[certId]/pdf` |
| 10.5 | Bulk certificate download per workpack / event | query param export |

---

## Sprint 11 — Schedule & Gantt

**Theme:** Event-wide Gantt with P6/MSP import/export round-trip

| # | Feature |
|---|---|
| 11.1 | P6 XER / XML import — review + commit flow |
| 11.2 | MS Project XML import |
| 11.3 | Gantt chart (`gantt-task-react`) — drag-resize, predecessors, float, critical path |
| 11.4 | Schedule export back to P6/MSP |
| 11.5 | Baseline vs actual toggle |
| 11.6 | S-curve generation (`GET /api/schedule/s-curve?eventId=`) |

---

## Sprint 12 — Activity Library & Resource Loading

| # | Feature |
|---|---|
| 12.1 | Activity Library CRUD + search (`/platform-data/master-data/activity-codes`) |
| 12.2 | "Add from library" in workpack Activities tab |
| 12.3 | Activity code backfill & validation tool |
| 12.4 | Resource-loaded schedule — histograms by discipline by day |
| 12.5 | Calendar (working hours, holidays, shift patterns) |

---

## Sprint 13 — Asset Register & P&ID AI Extraction

| # | Feature |
|---|---|
| 13.1 | Asset register tree — Site → Plant → Unit → System → Asset |
| 13.2 | Asset detail page — nozzles, lines, joints, drawings, procedures |
| 13.3 | P&ID upload → AI extraction job → conflict resolution UI |
| 13.4 | Bulk import (xlsx) for line list, joint master |
| 13.5 | Equipment type library with default nozzle/joint count |

---

## Sprint 14 — Event (STO) Management

| # | Feature |
|---|---|
| 14.1 | Event CRUD — name, type, phase, planned vs actual dates |
| 14.2 | Scope selection (units, systems in event) |
| 14.3 | Event dashboard — KPIs, critical path health, burn-down |
| 14.4 | Multi-project support (sub-phases inside an event) |
| 14.5 | Event close-out & archive |

---

## Sprint 15 — WBS & Scope Planning

| # | Feature |
|---|---|
| 15.1 | WBS node CRUD — event → phases → systems → workpacks → activities |
| 15.2 | Scope planning page — drag units/systems into event |
| 15.3 | Unit dashboard — unit-level KPIs + workpack list |
| 15.4 | System-level view — lines, joints, blinds, WBS |

---

## Sprint 16 — AI Suite Full Wiring

| # | Feature |
|---|---|
| 16.1 | AI provider settings CRUD (per-tenant Vertex/OpenAI/Gemini keys) |
| 16.2 | Prompt library (versioned, tagged) |
| 16.3 | AI usage log with token/cost accounting |
| 16.4 | Inline AI actions with progress (Extract from document, Suggest lessons) |
| 16.5 | Extraction conflict resolution UI |
| 16.6 | AI-assisted workpack creation (from asset + equipment-type template) |

---

## Sprint 17 — WhatsApp Field Updates

| # | Feature |
|---|---|
| 17.1 | WhatsApp session pairing (QR link via Business API) |
| 17.2 | Inbound webhook — parse text/photo/voice referencing workpack ID |
| 17.3 | AI parsing of inbound messages → progress update / photo / voice transcript |
| 17.4 | WhatsApp review queue — accept / reject |
| 17.5 | Audio transcription endpoint |

---

## Sprint 18 — Shift Reports & Lessons

| # | Feature |
|---|---|
| 18.1 | Auto-compiled shift report per unit |
| 18.2 | Multi-recipient email distribution |
| 18.3 | WhatsApp pull-in → shift report |
| 18.4 | Shift report PDF + HTML email |
| 18.5 | Lessons learnt library — searchable, tagged |
| 18.6 | AI lessons suggestion from workpack data |

---

## Sprint 19 — Reporting & Analytics

| # | Feature |
|---|---|
| 19.1 | Event dashboard — S-curve, critical path, resource histogram, safety |
| 19.2 | Custom report templates (saved queries) |
| 19.3 | Scheduled report emails |
| 19.4 | Exports — xlsx, PDF, CSV for workpacks / joints / blinds / punch |
| 19.5 | Portfolio dashboard — org-wide KPIs across all active events |

---

## Sprint 20 — Notifications & Audit

| # | Feature |
|---|---|
| 20.1 | In-app notification bell — unread count, grouped, per event type |
| 20.2 | Email digests (daily/weekly per-user prefs) |
| 20.3 | Webhook-out (customer webhook endpoint per tenant) |
| 20.4 | Audit log viewer — tenant-wide, filter by model/actor |
| 20.5 | Audit log export for compliance |
| 20.6 | Retention policy per tenant |

---

## Sprint 21 — Org Settings Completion

**Theme:** Fill all orphaned settings routes; map missing sidebar items

| # | Feature |
|---|---|
| 21.1 | Sites & Plants CRUD (tree editor) |
| 21.2 | Disciplines, Contractors, Resource types CRUD |
| 21.3 | Clearance parties — map to settings sidebar (currently orphaned) |
| 21.4 | Unit responsibilities — map to settings sidebar (currently orphaned) |
| 21.5 | Billing / Subscription — move to `/settings/subscription` (from root `/billing`) |
| 21.6 | Notification preferences page |

---

## Sprint 22 — System Settings ⭐

**Theme:** Tenant-level system configuration — email, API access, webhooks, storage, maintenance

> **Important:** `/settings/system` is **tenant-owned config**. It is distinct from `/platform/system` which is renamed to `System Health` (Redis/worker queue monitoring for super-admins).

### Tab 1 — Email & Communications
| Setting | Description |
|---|---|
| Outbound email address | Reply-to for all tenant system emails |
| Email footer / branding | Custom signature block on generated emails |
| Notification digest frequency | Default for org (daily / weekly / none) |
| Shift report recipient list | Default recipients for automated shift reports |
| Webhook delivery log | View last 50 outbound webhook calls + retry |

### Tab 2 — API Access
| Setting | Description |
|---|---|
| API key management | Generate / revoke tenant API keys |
| Allowed IP whitelist | Restrict API calls to specific IP ranges |
| OAuth client credentials | For SSO / external system OAuth apps |
| Webhook endpoint config | URL + secret for outbound event webhooks |

### Tab 3 — Data & Storage
| Setting | Description |
|---|---|
| File storage quota | View used vs allocated S3 storage |
| Attachment retention policy | Auto-delete attachments after N days |
| Data export | Download full tenant data archive (GDPR) |
| Audit log retention | How long to keep audit records |

### Tab 4 — Feature Toggles
| Setting | Description |
|---|---|
| Module enable/disable | Toggle: Safety, WhatsApp, Permits, AI, Shift Reports |
| Experimental features | Opt-in to beta features before GA |
| Mobile app access | Enable/disable mobile entry for field crew |

### Tab 5 — Maintenance
| Setting | Description |
|---|---|
| System maintenance banner | Message shown to all users in-app |
| Read-only mode | Temporarily lock all writes |
| Scheduled downtime | Set planned downtime window + user notification |

### API Routes
```
GET    /api/settings/system
PATCH  /api/settings/system
GET    /api/settings/system/api-keys
POST   /api/settings/system/api-keys
DELETE /api/settings/system/api-keys/[id]
GET    /api/settings/system/webhooks
PATCH  /api/settings/system/webhooks
GET    /api/settings/system/webhooks/log
POST   /api/settings/system/webhooks/test
GET    /api/settings/system/storage
POST   /api/settings/system/export
```

---

## Sprint 23 — Integrations Hub

| # | Integration | Type |
|---|---|---|
| 23.1 | SAP (materials, BOM, reservation sync) | REST / IDoc bridge |
| 23.2 | Primavera P6 (XER/XML scheduled auto-sync) | file-based |
| 23.3 | MS Project (XML) | file-based |
| 23.4 | Outlook / Gmail / MS365 calendar sync | OAuth + webhook |
| 23.5 | Slack / Teams notification routing | webhook |
| 23.6 | DocuSign / Adobe Sign for certificate signing | OAuth |

**UI:** `/settings/integrations` — one card per connector: connect / test / last-sync / logs

---

## Sprint 24 — SSO & Enterprise Auth

| # | Feature |
|---|---|
| 24.1 | Azure AD / Okta / Google Workspace SSO (OIDC) |
| 24.2 | SAML 2.0 hook |
| 24.3 | MFA (TOTP) — optional per tenant flag |
| 24.4 | Session management — view + revoke active sessions |
| 24.5 | Password reset + email verification flows |

---

## Sprint 25 — Mobile Optimisation & Offline

| # | Feature |
|---|---|
| 25.1 | Mobile-optimised workpack view (responsive tabs, swipe) |
| 25.2 | Offline-first punch list entry (IndexedDB + sync) |
| 25.3 | Field photo capture (camera API integration) |
| 25.4 | Offline shift report entry |
| 25.5 | PWA manifest + service worker |

---

## Sprint Summary

| Sprint | Theme | Layer |
|---|---|---|
| 1–5 | Foundation → AI pipeline | Platform Services |
| **6** | 3-Layer Governance | Platform |
| **7** | Workpack Lifecycle | Tenant |
| **8** | Materials & SAP | Tenant |
| **9** | Checklists & Clearance | Tenant |
| **10** | Certificates (JCC) | Tenant |
| **11** | Schedule & Gantt | Tenant |
| **12** | Activity Library | Master Data |
| **13** | Asset Register + AI | Tenant |
| **14** | Events (STO) | Tenant |
| **15** | WBS & Planning | Tenant |
| **16** | AI Suite | Platform + Tenant |
| **17** | WhatsApp | Tenant |
| **18** | Shift Reports + Lessons | Tenant |
| **19** | Reporting & Analytics | Tenant |
| **20** | Notifications & Audit | Tenant |
| **21** | Org Settings Completion | Tenant |
| **22** ⭐ | **System Settings** | Tenant |
| **23** | Integrations Hub | Tenant |
| **24** | SSO & Enterprise Auth | Platform + Tenant |
| **25** | Mobile & Offline | Tenant |
