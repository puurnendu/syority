# AURIANOA OS — Refinery Shutdown / Turnaround / Outage Management

**Full Feature Specification, API Route Map & Wireframe Blueprint**
**Version:** 1.0 (draft)
**Prepared as:** architectural baseline for aurianoa-sto-v2
**Stack:** Next.js 16 (App Router) · React 19 · Prisma 7 / PostgreSQL · next-auth · CASL · BullMQ/Redis · S3 · Vertex AI / OpenAI · Tailwind 4

---

## 0. System Overview

AURIANOA OS is a multi-tenant SaaS platform that runs the full lifecycle of a refinery / petrochemical / LNG **Shutdown, Turnaround and Outage (STO) event** — from long-range planning and scoping through execution, clearance, box-up, start-up and post-event lessons learned.

The domain is built around seven first-class objects:

1. **Event** — the STO itself (dates, phases, strategy, KPIs).
2. **Unit / System / Asset** — physical breakdown of the plant being worked on.
3. **Workpack** — the atomic unit of field work (one asset or scope, fully planned, executed and signed off).
4. **Activity** — the scheduled task inside a workpack (ties to Primavera / MS Project).
5. **Joint / Blind / Line** — pressure-envelope items tracked end-to-end.
6. **Clearance / Certificate** — the signatures that release work and prove it's done.
7. **Punch / Lesson / Incident** — the feedback loop.

Everything else is either a **master data** object (item catalog, resources, disciplines, contractors, templates), a **platform / tenant** object (orgs, sites, plants, users, roles, feature flags, billing), or a **cross-cutting** service (AI, notifications, audit, reporting, file store).

---

## 1. User Personas & Role Matrix

| Role | Scope | Primary jobs |
|---|---|---|
| **Super Admin** (Platform) | All tenants | Provision tenants, platform library, billing, feature flags |
| **Org Admin** | One tenant | Sites, users, roles, templates, organization settings |
| **Turnaround Manager** | Event | Approve scope, budget, schedule baseline, critical path |
| **Planner / Scheduler** | Event → Workpack | Build workpacks, import/export P6/MSP schedule, resource-loading |
| **Workpack Manager** | Workpack | Day-to-day owner of workpack, constraints, materials, approvals |
| **Discipline Engineer** (Mech / Piping / E&I / Inspection / Civil) | Workpacks in discipline | Technical sign-off, QA, hold points |
| **Field Supervisor / Foreman** | Assigned activities | Progress, shift reports, punch items, WhatsApp updates |
| **QA / QC Inspector** | Joints, Blinds, Clearance | Witness sign-off, certificate generation |
| **HSE** | Event-wide | Safety logs, incidents, permits overlap |
| **Contractor User** | Own workpacks only | Mobile execution, limited read-write |
| **Read-Only / Stakeholder** | Dashboards | Reporting, exec view |

RBAC is enforced at three layers: `middleware.ts` (page), `apiGuard.guardApi(permission)` (route), `CASL ability` (record). Permissions are defined in `src/lib/permissions.ts` and mapped onto roles; feature flags (`TenantFeatureFlag`) gate modules per tenant.

---

## 2. Hierarchy & Scope Model

```
Platform
  └── Organization (tenant)
        ├── Site
        │     └── Plant
        │           └── Unit  ──┐
        │                       ├── System
        │                       │     ├── Asset (Equipment)
        │                       │     │     └── Nozzle
        │                       │     ├── LineList → AssetLine
        │                       │     ├── JointMaster
        │                       │     ├── Blind (SystemBlind)
        │                       │     ├── Gasket / Drawing / Procedure
        │                       │     └── WBS Node
        └── Event (STO)  ──┐
                           ├── EventUnit (scope)
                           ├── EventSystem (scope)
                           ├── Project (sub-scope / phase)
                           └── Workpack (execution)
                                  ├── Activity → ActivityRelationship
                                  ├── WorkpackMaterial / MaterialLine
                                  ├── WorkpackTool
                                  ├── Constraint
                                  ├── JointIntegrityItem
                                  ├── Blind (execution instance)
                                  ├── DroppingBoxupChecklist
                                  ├── QaClearanceRecord
                                  ├── PunchListItem
                                  ├── ClearanceForBoxup / ClearanceSignOff
                                  ├── JobCompletionCertificate
                                  ├── CertificateInstance
                                  ├── FormInstance (+ entries)
                                  ├── DocumentInstance (+ attachments)
                                  ├── LessonsLearnt
                                  └── ShiftReport (via Unit)
```

---

## 3. Feature Domains

Each domain block below lists: **(a)** features, **(b)** the primary Prisma models touched, **(c)** the REST API surface, **(d)** the UI / page wireframe.

### 3.1 Platform & Tenant Management

**Features**

- Tenant provisioning, suspension, soft-delete
- Tenant feature flags (per-module enable/disable)
- Platform library: reusable Activity Codes, UDF definitions, certificate templates, document templates, equipment types, clearance parties
- Billing log (usage snapshots — events, workpacks, AI tokens, storage)
- Platform-wide audit & email logs (see §3.25)

**Models:** `Organization`, `BillingLog`, platform library models under `src/core/Platform/*`, `TenantFeatureFlag` (to add per audit), `PlatformConfig` (to add).

**Routes (`app/api/admin/*`, `app/api/central/*`, `app/api/platform/*`)**

```
GET    /api/admin/tenants                  list tenants
POST   /api/admin/tenants                  create tenant
GET    /api/admin/tenants/[id]             detail
PATCH  /api/admin/tenants/[id]             update (flags, plan, status)
DELETE /api/admin/tenants/[id]             soft delete
POST   /api/admin/tenants/[id]/suspend
POST   /api/admin/tenants/[id]/restore

GET    /api/admin/features                 feature-flag catalog
PATCH  /api/admin/features                 bulk update flags for tenant
GET    /api/admin/billing                  usage rollup per tenant
GET    /api/admin/templates                platform templates
POST   /api/admin/templates
GET    /api/admin/templates/[id]
PATCH  /api/admin/templates/[id]
DELETE /api/admin/templates/[id]
POST   /api/admin/templates/[id]/publish   → tenants
GET    /api/admin/clearance-parties
POST   /api/admin/clearance-parties
GET    /api/admin/equipment-types
POST   /api/admin/equipment-types
```

**UI**

- `/platform` — Super-admin console (tenant list, KPIs, health)
- `/platform/tenants/[id]` — tenant detail (flags, users, billing, audit)
- `/platform-data/*` — platform library editors (activity codes, UDF defs, templates, equipment types, clearance parties)

---

### 3.2 Identity, Auth & RBAC

**Features**

- Email + password login (next-auth Credentials), JWT session
- SSO-ready (OIDC / SAML hook in `authOptions.providers`)
- Multi-role per user (`UserRole` join), scoped to site
- MFA (TOTP) — optional per tenant flag
- Password reset, email verification
- Session-scoped impersonation (super-admin → tenant user, with audit)
- Permission registry (`src/lib/permissions.ts`) + CASL abilities per role
- Per-site scoping baked into every query via `orgScope(session)`

**Models:** `User`, `Role`, `UserRole`, `Organization`, `Site`.

**Routes**

```
POST   /api/auth/[...nextauth]             next-auth
POST   /api/auth/register                  (if self-serve allowed)
POST   /api/auth/password/request-reset
POST   /api/auth/password/reset
POST   /api/auth/mfa/enroll
POST   /api/auth/mfa/verify
POST   /api/auth/impersonate/[userId]      super-admin only
POST   /api/auth/impersonate/stop
GET    /api/users                          tenant users
POST   /api/users
GET    /api/users/[id]
PATCH  /api/users/[id]                     role, site, status
DELETE /api/users/[id]
GET    /api/users/[id]/sessions            active sessions
POST   /api/users/[id]/sessions/revoke
```

**UI**

- `/login`, `/onboarding/*`, `/settings/users`, `/settings/roles`

---

### 3.3 Organization Settings & Master Data

**Features**

- Org profile (name, logo, address, timezone, units, currency)
- Sites & Plants (CRUD)
- Disciplines, Contractors, Resource types, Resources
- Item Catalog (materials + gasket/bolt lookup)
- UDF (user-defined field) registry for workpacks, activities, joints, blinds
- Certificate templates, document templates, form templates (versioned)
- Print settings (letterhead, page size, QR codes, signature blocks)
- Workflow transitions (customizable state machines for workpack & certificate)

**Models:** `Organization`, `OrganizationDocumentSetting`, `Site`, `Plant`, `Discipline`, `Contractor`, `ResourceType`, `Resource`, `ItemCatalog`, `GasketBoltLookup`, `ActivityUdfDefinition`, `ActivityUdfOption`, `DocumentTemplate`, `FormTemplate`, `FormTemplateVersion`, `CertificateTemplate`, `WorkpackPrintSettings`, `WorkflowTransition`.

**Routes (`app/api/settings/*`, `app/api/master-data/*`)**

```
GET    /api/settings/organization
PATCH  /api/settings/organization
GET    /api/settings/sites
POST   /api/settings/sites
GET    /api/settings/sites/[siteId]
PATCH  /api/settings/sites/[siteId]
DELETE /api/settings/sites/[siteId]
GET    /api/settings/sites/[siteId]/plants
POST   /api/settings/sites/[siteId]/plants
PATCH  /api/settings/sites/[siteId]/plants/[plantId]
DELETE /api/settings/sites/[siteId]/plants/[plantId]

GET    /api/disciplines      POST  PATCH  DELETE
GET    /api/settings/roles   POST  PATCH  DELETE
GET    /api/settings/udf-definitions
POST   /api/settings/udf-definitions
GET    /api/settings/udf-definitions/[id]
PATCH  /api/settings/udf-definitions/[id]
DELETE /api/settings/udf-definitions/[id]

GET    /api/master-data/items
POST   /api/master-data/items
GET    /api/master-data/items/[itemId]
PATCH  /api/master-data/items/[itemId]
DELETE /api/master-data/items/[itemId]
POST   /api/master-data/items/import        xlsx upload
GET    /api/master-data/gasket-lookup
POST   /api/master-data/gasket-lookup/import

GET    /api/settings/templates              document + form templates
POST   /api/settings/templates
GET    /api/settings/templates/[id]
PATCH  /api/settings/templates/[id]
POST   /api/settings/templates/[id]/versions
GET    /api/settings/certificate-templates
POST   /api/settings/certificate-templates
GET    /api/settings/certificate-templates/[templateId]
PATCH  /api/settings/certificate-templates/[templateId]
GET    /api/settings/print-settings
PATCH  /api/settings/print-settings
```

**UI**

- `/settings` (tabs: Organization, Users, Roles, Sites, Disciplines, Resources, Master Data, UDFs, Templates, Certificates, Print, Integrations)
- `/settings/sites/[siteId]` — site/plant tree editor
- `/settings/master-data/items` — item catalog table + xlsx import
- `/settings/templates/[id]` — template designer (fields, versioning, publish)

---

### 3.4 Asset Register & Physical Hierarchy

**Features**

- CRUD on Units, Systems, Assets, Nozzles, Lines, Joints, Blinds, Gaskets, Drawings, Procedures
- P&ID upload → AI extraction (`AiExtractionJob`) → confirm / resolve conflicts
- Bulk import (xlsx) for asset register, line list, joint master, blind register
- Hierarchy search & explorer (tree + table)
- Attach drawings, datasheets, procedures to any node
- Equipment type library (shell & tube, column, pump, etc.) with default nozzle/joint count

**Models:** `Unit`, `System`, `Asset`, `Nozzle`, `LineList`, `AssetLine`, `JointMaster`, `SystemBlind`, `SystemGasket`, `SystemDrawing`, `SystemProcedure`, `WbsNode`, `AiExtractionJob`, `AiExtractionResult`, `ExtractionConflict`.

**Routes**

```
GET    /api/hierarchy                              tree (site→plant→unit→system→asset)
GET    /api/hierarchy/asset/[assetId]              breadcrumb
GET    /api/units               POST               CRUD
GET    /api/units/[unitId]      PATCH DELETE
GET    /api/units/[unitId]/responsibilities
POST   /api/units/[unitId]/responsibilities
GET    /api/systems             POST
GET    /api/systems/[systemId]  PATCH DELETE
GET    /api/systems/[systemId]/blinds/[blindId]
GET    /api/systems/[systemId]/drawings/[drawingId]
GET    /api/systems/[systemId]/gaskets/[gasketId]
GET    /api/systems/[systemId]/procedures/[procedureId]
GET    /api/systems/[systemId]/events/[eventId]    system-in-event view

GET    /api/assets              POST
GET    /api/assets/[assetId]    PATCH DELETE
GET    /api/assets/[assetId]/nozzles/[nozzleId]

GET    /api/line-lists          POST
GET    /api/line-lists/[lineId] PATCH DELETE
POST   /api/line-lists/import

GET    /api/joint-masters       POST
GET    /api/joint-masters/[jointId] PATCH DELETE

POST   /api/asset-register/extract-pid                kick off AI job
GET    /api/asset-register/extract-pid/[jobId]        job status
POST   /api/asset-register/extract-pid/[jobId]/confirm resolve conflicts
POST   /api/asset-register/import                     xlsx bulk import

GET    /api/wbs                 POST
GET    /api/wbs/[nodeId]        PATCH DELETE
```

**UI**

- `/asset-register` — tree explorer (Plant → Unit → System → Asset)
- `/asset-register/[assetId]` — asset detail (info, nozzles, lines, joints, blinds, drawings, history)
- `/planning/systems/[systemId]` — system-level view (lines, joints, blinds, WBS)
- `/planning/units/[unitId]` — unit dashboard
- `/settings/wbs` — WBS editor

---

### 3.5 Event (STO) Management

**Features**

- Create event (name, type: shutdown/turnaround/outage/inspection, phase: planning→execution→close-out, planned vs actual dates)
- Scope selection (units, systems)
- Event dashboard: KPIs, critical path, curve (S-curve), burn-down
- Event-level safety log & incident register
- Multi-project support (sub-phases or campaigns inside an event)
- Close-out & archive

**Models:** `Event`, `EventUnit`, `EventSystem`, `Project`, `ProjectUnit`, `SafetyLog`, `SafetyIncident`, `SafetyPhoto`.

**Routes**

```
GET    /api/events                                list
POST   /api/events                                create
GET    /api/events/[eventId]                      detail + KPIs
PATCH  /api/events/[eventId]
DELETE /api/events/[eventId]
POST   /api/events/[eventId]/close-out
GET    /api/events/[eventId]/units
POST   /api/events/[eventId]/units
PATCH  /api/events/[eventId]/units/[unitId]
DELETE /api/events/[eventId]/units/[unitId]
GET    /api/events/[eventId]/reports             event-level reports
GET    /api/events/[eventId]/safety              safety log list
POST   /api/events/[eventId]/safety
GET    /api/events/[eventId]/safety/incidents
POST   /api/events/[eventId]/safety/incidents
PATCH  /api/events/[eventId]/safety/incidents/[incidentId]

GET    /api/projects             POST
GET    /api/projects/[id]        PATCH DELETE
```

**UI**

- `/events` — list of events (status chips, progress)
- `/events/[eventId]` — event dashboard (header, phase timeline, KPIs, scope, team, safety)
- `/events/[eventId]/safety` — safety tab
- `/events/[eventId]/reports` — reporting tab
- `/events/[eventId]/units/[unitId]` — drill-down

---

### 3.6 Planning & Scheduling

**Features**

- WBS builder (event → phases → systems → workpacks → activities)
- Activity Library (codified tasks with default duration, predecessors, UDFs, resources)
- Schedule import from **Primavera P6** (XER / XML) and **MS Project** (XML / MPP via conversion)
- Schedule export back to P6/MSP
- Gantt chart (`gantt-task-react`) with drag-resize, predecessors, float, critical path
- Resource-loaded schedule, histograms
- Activity code backfill & validation
- Schedule baseline vs actual, progress % by rules of credit
- Calendar (working hours, holidays, shift patterns)

**Models:** `Activity`, `ActivityRelationship`, `ActivityLibrary`, `ActivityResource`, `ScheduleImportBatch`, `ScheduleImportJob`, `ScheduleExportJob`, `ActivityCodeDefaultResource`.

**Routes**

```
GET    /api/activities                       list (paginated, filterable)
POST   /api/activities
GET    /api/activities/[id]   PATCH DELETE
POST   /api/schedule/import                  upload XER / XML
GET    /api/schedule/import/[jobId]          status
POST   /api/schedule/import/[jobId]/commit   apply to DB
POST   /api/schedule/export                  produce XER / XML
GET    /api/schedule/export/[jobId]
GET    /api/schedule/gantt?eventId=          data for Gantt
GET    /api/schedule/critical-path?eventId=
GET    /api/schedule/s-curve?eventId=

GET    /api/workpacks/[id]/activities
POST   /api/workpacks/[id]/activities
GET    /api/workpacks/[id]/activities/[activityId]
PATCH  /api/workpacks/[id]/activities/[activityId]
DELETE /api/workpacks/[id]/activities/[activityId]
GET    /api/workpacks/[id]/activities/[activityId]/predecessors
POST   /api/workpacks/[id]/activities/[activityId]/predecessors
DELETE /api/workpacks/[id]/activities/[activityId]/predecessors/[relId]
```

**UI**

- `/schedule` — event-wide Gantt
- `/planning` — scope planning (drag units/systems into event)
- `/workpacks/[id]` → **Activities tab** — per-workpack Gantt + table
- `/settings/activity-library` — library editor

---

### 3.7 Workpack Management (core)

**Features**

- Workpack lifecycle: draft → planning → ready → in-progress → clearance → boxup → mechanical-complete → closed
- Approval workflow (`approval_status`, submit / approve / reject with comments)
- Versioning (`WorkpackVersion`) — every approve creates an immutable snapshot
- Rich tabs per workpack: Overview, Activities, Materials, Tools, Constraints, Joints, Blinds, Checklists (Drop/Boxup), QA / Clearance, Documents, Forms, Certificates, Punch, Lessons, Attachments, Audit
- Auto-numbering (`WorkpackIdCounter`) per site/event/equipment-type
- AI-assisted workpack creation (generate from asset + equipment-type template)
- PDF print (full dossier) with configurable sections
- Clone / template workpacks (`WorkpackTemplate`)

**Models:** `Workpack`, `WorkpackAttachment`, `WorkpackDocument`, `WorkpackVersion`, `WorkpackIdCounter`, `WorkpackTemplate`, `WorkpackTemplateActivity`, `TemplateChecklistItem`, `WorkpackPrintSettings`, `Activity`, `WorkpackMaterial`, `WorkpackMaterialLine`, `WorkpackTool`, `Constraint`, `ConstraintLog`, `ConstraintAttachment`.

**Routes**

```
GET    /api/workpacks                          list, filterable
POST   /api/workpacks                          create
GET    /api/workpacks/next-number              preview next ID
GET    /api/workpacks/preview-id
POST   /api/workpacks/ai-generate              AI-assisted draft
GET    /api/workpacks/[id]                     detail
PATCH  /api/workpacks/[id]
DELETE /api/workpacks/[id]
POST   /api/workpacks/[id]/submit              → approval
POST   /api/workpacks/[id]/approve
POST   /api/workpacks/[id]/reject
POST   /api/workpacks/[id]/clone
GET    /api/workpacks/[id]/pdf                 full dossier PDF
GET    /api/workpacks/[id]/workflow            state machine
POST   /api/workpacks/[id]/workflow            transition
GET    /api/workpacks/[id]/audit
GET    /api/workpacks/[id]/summary-counts      badge numbers

# nested resources
/api/workpacks/[id]/activities/...
/api/workpacks/[id]/materials/...
/api/workpacks/[id]/tools/...
/api/workpacks/[id]/constraints/...
/api/workpacks/[id]/joints/...
/api/workpacks/[id]/blinds/...                  (see §3.9)
/api/workpacks/[id]/checklists/...              (see §3.10)
/api/workpacks/[id]/clearance-boxup/...         (see §3.11)
/api/workpacks/[id]/jcc/...                     (see §3.12)
/api/workpacks/[id]/punch-list/...              (see §3.13)
/api/workpacks/[id]/documents/...               (see §3.14)
/api/workpacks/[id]/certificates/...            (see §3.15)
/api/workpacks/[id]/lessons/...                 (see §3.16)
/api/workpacks/[id]/attachments/...             (see §3.17)
/api/workpacks/[id]/extract-document/[jobId]    AI extraction (see §3.20)
/api/workpacks/[id]/suggest-lessons/[jobId]     AI lessons suggestion
/api/workpacks/[id]/extract-technical-data
/api/workpacks/[id]/technical-data
/api/workpacks/[id]/sap-sync                    push to SAP
```

**UI**

- `/workpacks` — filterable table (status, event, unit, discipline, workpack manager, due)
- `/workpacks/new` — 3-step wizard (Asset → Template → Scope)
- `/workpacks/[id]` — tabbed workspace (see tabs above), sticky header with status chip, progress %, next hold point, quick actions (Submit, Print, Clone)

---

### 3.8 Joint Integrity Management

**Features**

- Joint register per workpack (line, size, schedule, material, test medium, pressure, status)
- Bolt tensioning / torqueing record
- Re-torque cycles & re-inspect flags
- QC statuses: Fit-up → Weld → NDT → Hydro → Leak Test → Closed
- Inspector sign-off with date + initials + photos
- Joint reports (per-line, per-system, NDT due list)
- Import from joint master + line list

**Models:** `JointIntegrityItem`, `JointMaster`, `AssetLine`, `LineList`.

**Routes**

```
GET    /api/workpacks/[id]/joints
POST   /api/workpacks/[id]/joints
GET    /api/workpacks/[id]/joints/[jointId]
PATCH  /api/workpacks/[id]/joints/[jointId]
DELETE /api/workpacks/[id]/joints/[jointId]
POST   /api/workpacks/[id]/joints/import            from line list
POST   /api/workpacks/[id]/joints/[jointId]/sign-off
GET    /api/workpacks/[id]/joints/report?type=ndt-due|hydro|leak
```

**UI**

- `/workpacks/[id]` → **Joints** tab — table + inline edit, status columns, sign-off modal
- `/planning/joints` — event-wide joint register

---

### 3.9 Blinds Register

**Features**

- Blinds master (per system, from isolation list) and execution blinds (installed / removed per workpack)
- Status: proposed → installed → verified → removed → reconciled
- Blind list reconciliation report (zero-energy before boxup)
- Photo evidence per install & remove
- Linked gasket spec / size / thickness / standard

**Models:** `SystemBlind` (master), `Blind` (execution), `SystemGasket`.

**Routes**

```
GET    /api/workpacks/[id]/blinds
POST   /api/workpacks/[id]/blinds
GET    /api/workpacks/[id]/blinds/[blindId]
PATCH  /api/workpacks/[id]/blinds/[blindId]
DELETE /api/workpacks/[id]/blinds/[blindId]
POST   /api/workpacks/[id]/blinds/reconcile          produce reconciliation
```

**UI**

- `/workpacks/[id]` → **Blinds** tab
- `/planning/blinds` — event blind register

---

### 3.10 Cleaning, De-inventory, Dropping & Box-up Checklists

**Features**

- Template-driven checklists (org-level templates seeded into each workpack)
- Dropping checklist: drain / flush / purge / isolate / verify / hand over
- Box-up checklist: install gaskets / torque / reinstate / leak test / re-pressurize
- Per-item sign-off with name + initials + timestamp + photo
- Completion gate — cannot progress state until checklist complete

**Models:** `DroppingBoxupChecklist`, `DroppingBoxupChecklistItem`, `CleaningRecord`, `TemplateChecklistItem`.

**Routes**

```
GET    /api/workpacks/[id]/checklists                list (drop + boxup)
POST   /api/workpacks/[id]/checklists                create from template
GET    /api/workpacks/[id]/checklists/[checklistId]
PATCH  /api/workpacks/[id]/checklists/[checklistId]
POST   /api/workpacks/[id]/checklists/[checklistId]/items/[itemId]/sign
GET    /api/workpacks/[id]/cleaning                  cleaning records
POST   /api/workpacks/[id]/cleaning
```

**UI**

- `/workpacks/[id]` → **Checklists** tab (Drop + Boxup accordions)

---

### 3.11 Clearance for Box-up / Hold Points / QA

**Features**

- Hold-point definition (witness / surveillance / hold)
- Multi-party sign-off (client, EPC, vendor, HSE, operations)
- Waiver workflow (reason + authoriser + expiry)
- Clearance-for-boxup certificate (digital signature, QR code, PDF print)
- Clearance party library (`OrgClearanceParty`)

**Models:** `QaClearanceRecord`, `ClearanceForBoxup`, `ClearanceSignOff`, `OrgClearanceParty`.

**Routes**

```
GET    /api/workpacks/[id]/clearance-boxup
POST   /api/workpacks/[id]/clearance-boxup
GET    /api/workpacks/[id]/clearance-boxup/[id]
PATCH  /api/workpacks/[id]/clearance-boxup/[id]
POST   /api/workpacks/[id]/clearance-boxup/sign-off
POST   /api/workpacks/[id]/clearance-boxup/sign-off/[signOffId]/revoke
GET    /api/workpacks/[id]/approval                 approval state
POST   /api/workpacks/[id]/approval                 submit / decide
GET    /api/admin/clearance-parties
POST   /api/admin/clearance-parties
PATCH  /api/admin/clearance-parties/[id]
DELETE /api/admin/clearance-parties/[id]
```

**UI**

- `/workpacks/[id]` → **QA / Clearance** tab (hold-point matrix, sign-off panel, PDF preview)

---

### 3.12 Job Completion Certificate (JCC) & Certificate Library

**Features**

- JCC auto-generated on mechanical complete (pulls data from workpack)
- Custom certificate templates (hydro-test, pneumatic test, NDT, fit-up, tightness, paint, insulation, etc.)
- Template fields → instance values (typed — string, number, date, bool, image, signature)
- Generate PDF, signer link (email or QR), countersign workflow
- Bulk download per workpack / event

**Models:** `JobCompletionCertificate`, `CertificateTemplate`, `CertificateInstance`.

**Routes**

```
GET    /api/workpacks/[id]/jcc
POST   /api/workpacks/[id]/jcc/generate
GET    /api/workpacks/[id]/certificates
POST   /api/workpacks/[id]/certificates           from template
GET    /api/workpacks/[id]/certificates/[certId]
PATCH  /api/workpacks/[id]/certificates/[certId]
POST   /api/workpacks/[id]/certificates/[certId]/sign
GET    /api/workpacks/[id]/certificates/[certId]/pdf
GET    /api/certificate-templates                global/org templates
POST   /api/certificate-templates
```

**UI**

- `/workpacks/[id]` → **Certificates** tab (template picker, instance list, preview)
- `/settings/certificate-templates/[templateId]` — designer

---

### 3.13 Punch List

**Features**

- Categories: A (must before startup), B (before hand-over), C (later)
- Created from mobile / shift report / inspection
- Photos, location (system / asset / tag), responsible party, due date
- Statuses: open → in-progress → cleared → verified → closed
- Bulk export to xlsx / PDF, sign-off per category

**Models:** `PunchListItem`.

**Routes**

```
GET    /api/workpacks/[id]/punch-list
POST   /api/workpacks/[id]/punch-list
GET    /api/workpacks/[id]/punch-list/[itemId]
PATCH  /api/workpacks/[id]/punch-list/[itemId]
DELETE /api/workpacks/[id]/punch-list/[itemId]
POST   /api/workpacks/[id]/punch-list/[itemId]/verify
GET    /api/events/[eventId]/punch-list              event-wide roll-up
GET    /api/punch/export?eventId=...
```

**UI**

- `/punch` — event-wide board (category A / B / C columns)
- `/workpacks/[id]` → **Punch** tab

---

### 3.14 Documents, Forms & Attachments

**Features**

- Document templates (DOCX / PDF fill-in fields) — versioned
- Form templates (JSON schema — text, number, select, signature, image) — versioned
- Form instance + entries (audit per field edit)
- Attachments (any file, S3, presigned URL) with tagging & categorisation
- DOCX ingest (`mammoth`) for text extraction & template authoring
- PDF generation with `pdf-lib` + Puppeteer for complex layouts

**Models:** `DocumentTemplate`, `DocumentInstance`, `FormTemplate`, `FormTemplateVersion`, `FormInstance`, `FormEntry`, `Attachment`, `WorkpackAttachment`, `WorkpackDocument`.

**Routes**

```
GET    /api/documents                        list (filter by entity)
POST   /api/documents
GET    /api/documents/[id]
PATCH  /api/documents/[id]
DELETE /api/documents/[id]
GET    /api/workpacks/[id]/documents
POST   /api/workpacks/[id]/documents
GET    /api/workpacks/[id]/documents/[docId]
GET    /api/workpacks/[id]/documents/instance/[instanceId]
POST   /api/workpacks/[id]/documents/instance/[instanceId]/fill
GET    /api/workpacks/[id]/documents/instance/[instanceId]/pdf
GET    /api/workpacks/[id]/attachments
POST   /api/workpacks/[id]/attachments                   S3 upload (presigned)
DELETE /api/workpacks/[id]/attachments/[attachmentId]
POST   /api/workpacks/[id]/attachments/presign           get upload URL
```

**UI**

- `/documents` — library
- `/workpacks/[id]` → **Documents** / **Attachments** tabs
- `/settings/templates/[id]` — template editor (fields, layout, versioning)

---

### 3.15 Materials & Tools

**Features**

- BOM per workpack (from item catalog + free-text)
- Material lines (qty, unit, warehouse, status: requested → reserved → issued → returned)
- Gasket / bolt auto-lookup (`GasketBoltLookup`) when a joint is added
- Tools list (calibration status, cert expiry)
- SAP sync (push BOM to SAP for material reservation)
- Material shortage dashboard

**Models:** `WorkpackMaterial`, `WorkpackMaterialLine`, `WorkpackTool`, `ItemCatalog`, `GasketBoltLookup`, `ItemCatalogImportLog`.

**Routes**

```
GET    /api/workpacks/[id]/materials
POST   /api/workpacks/[id]/materials
GET    /api/workpacks/[id]/materials/[lineId]
PATCH  /api/workpacks/[id]/materials/[lineId]
DELETE /api/workpacks/[id]/materials/[lineId]
POST   /api/workpacks/[id]/materials/auto-fill-gaskets
POST   /api/workpacks/[id]/sap-sync

GET    /api/workpacks/[id]/tools
POST   /api/workpacks/[id]/tools
GET    /api/workpacks/[id]/tools/[toolId]
PATCH  /api/workpacks/[id]/tools/[toolId]
DELETE /api/workpacks/[id]/tools/[toolId]
```

**UI**

- `/workpacks/[id]` → **Materials** and **Tools** tabs
- `/events/[eventId]/materials` — event-wide BOM roll-up, shortage view

---

### 3.16 Constraints

**Features**

- Constraints on workpacks / activities (material / permit / crane / scaffold / engineering / client input / other)
- Status: open → mitigated → closed; overdue flag
- Constraint log (history) + attachments
- Impact analysis (which activities blocked; impact on critical path)

**Models:** `Constraint`, `ConstraintLog`, `ConstraintAttachment`.

**Routes**

```
GET    /api/workpacks/[id]/constraints
POST   /api/workpacks/[id]/constraints
GET    /api/workpacks/[id]/constraints/[constraintId]
PATCH  /api/workpacks/[id]/constraints/[constraintId]
DELETE /api/workpacks/[id]/constraints/[constraintId]
POST   /api/workpacks/[id]/constraints/[constraintId]/resolve
GET    /api/events/[eventId]/constraints        event-wide
```

**UI**

- `/constraints` — event board (by type, by status, overdue)
- `/workpacks/[id]` → **Constraints** tab

---

### 3.17 Safety

**Features**

- Safety log (daily)
- Incident register (near-miss, first-aid, LTI, etc.) with photos, root cause, corrective action
- Toolbox talk record
- Permit-to-work overlap check (against active workpacks / systems)
- Man-hour tracking

**Models:** `SafetyLog`, `SafetyIncident`, `SafetyPhoto`.

**Routes**

```
GET    /api/events/[eventId]/safety
POST   /api/events/[eventId]/safety
GET    /api/events/[eventId]/safety/incidents
POST   /api/events/[eventId]/safety/incidents
GET    /api/events/[eventId]/safety/incidents/[incidentId]
PATCH  /api/events/[eventId]/safety/incidents/[incidentId]
POST   /api/events/[eventId]/safety/incidents/[incidentId]/photos
```

**UI**

- `/safety` — event safety dashboard
- `/events/[eventId]/safety` — log + incidents

---

### 3.18 Shift Reports

**Features**

- Auto-compiled end-of-shift report per unit (progress, punch added, incidents, constraints, next shift handover)
- Multi-recipient email distribution (`UnitShiftReportRecipient`)
- WhatsApp pull-in — field updates collated into the report
- PDF + HTML email

**Models:** `ShiftReport`, `UnitShiftReportRecipient`.

**Routes**

```
GET    /api/shift-reports?eventId=&unitId=&date=
POST   /api/shift-reports                     generate for period
GET    /api/shift-reports/[id]
POST   /api/shift-reports/[id]/send
GET    /api/shift-reports/[id]/pdf
GET    /api/events/[eventId]/reports           shift report list
```

**UI**

- `/shift-reports` — calendar view + per-day report
- `/events/[eventId]/reports` — reports tab

---

### 3.19 Lessons Learnt

**Features**

- Workpack-level lessons (what went well / wrong / change)
- Event-level roll-up
- Searchable library (tagged by discipline, equipment-type, root cause)
- AI suggestions from workpack data (`suggest-lessons`)

**Models:** `LessonsLearnt`, `LessonLearned`, `AiSuggestedItem`.

**Routes**

```
GET    /api/workpacks/[id]/lessons
POST   /api/workpacks/[id]/lessons
GET    /api/workpacks/[id]/lessons/[lessonId]
PATCH  /api/workpacks/[id]/lessons/[lessonId]
DELETE /api/workpacks/[id]/lessons/[lessonId]
GET    /api/workpacks/[id]/lessons-learnt
POST   /api/workpacks/[id]/suggest-lessons      kicks AI job
GET    /api/workpacks/[id]/suggest-lessons/[jobId]
GET    /api/lessons                             library search
```

**UI**

- `/lessons` — library (filters: discipline, equipment, rca, site, event)
- `/workpacks/[id]` → **Lessons** tab

---

### 3.20 AI Suite (Extraction & Suggestions)

**Features**

- Provider-abstracted (Vertex AI, OpenAI) with per-tenant keys (`AiProviderSetting`)
- Prompt library (`AiPrompt`) — versioned, tagged, A/B-able
- Extraction jobs — P&ID, isometric, datasheet, mark-up document → structured JSON → conflict resolution
- Suggestion jobs — lessons learnt, activities, materials, risks
- AI usage log (`AiLog`) with token / cost accounting → billing log
- Guardrails: redaction, content filter, tenant opt-in

**Models:** `AiProviderSetting`, `AiPrompt`, `AiLog`, `AiExtractionJob`, `AiExtractionResult`, `ExtractionConflict`, `AiSuggestedItem`.

**Routes**

```
GET    /api/ai-config                 provider settings
PATCH  /api/ai-config
GET    /api/ai-prompts
POST   /api/ai-prompts
GET    /api/ai-prompts/[id]
PATCH  /api/ai-prompts/[id]
GET    /api/ai-logs?from=&to=
GET    /api/ai-logs/usage             rolled-up cost
POST   /api/asset-register/extract-pid
GET    /api/asset-register/extract-pid/[jobId]
POST   /api/workpacks/[id]/extract-document
GET    /api/workpacks/[id]/extract-document/[jobId]
POST   /api/workpacks/[id]/extract-technical-data
GET    /api/workpacks/[id]/technical-data
POST   /api/workpacks/[id]/suggest-lessons
GET    /api/workpacks/[id]/suggest-lessons/[jobId]
GET    /api/workpacks/[id]/extraction-conflicts
POST   /api/workpacks/[id]/extraction-conflicts/[conflictId]/resolve
POST   /api/workpacks/ai-generate     AI-assisted workpack
```

**UI**

- `/settings/ai` — provider settings, prompts, usage
- Inline AI actions throughout workpack tabs ("Extract from document", "Suggest lessons", etc.) with job progress

---

### 3.21 WhatsApp Integration (Field Updates)

**Features**

- Per-user WhatsApp session (QR link once, via Business API)
- Field crew sends text / photo / voice note referencing workpack ID
- Inbound message parsed (with AI) → attached to workpack timeline as progress update, photo, or voice-transcript
- Human review & accept / reject (`/whatsapp-reviews`)
- Audio transcription endpoint

**Models:** `WhatsappSession`, `WhatsappUpdate`.

**Routes**

```
POST   /api/webhooks/whatsapp                    inbound webhook
GET    /api/whatsapp                             session list
POST   /api/whatsapp/pair                        start pairing
GET    /api/whatsapp/updates
GET    /api/whatsapp/updates/[updateId]
PATCH  /api/whatsapp/updates/[updateId]          accept / reject
GET    /api/whatsapp/audio/[updateId]            audio file / transcription
```

**UI**

- `/whatsapp-reviews` — triage queue
- Workpack timeline shows inbound updates

---

### 3.22 Reporting & Analytics

**Features**

- Event dashboard (progress S-curve, critical path health, resource histogram, constraints, punch, safety, cost)
- Workpack-level reports
- Custom reports (saved queries, exportable) — `reporting/templates`
- Scheduled report emails
- Exports: xlsx, PDF, CSV

**Routes**

```
GET    /api/dashboard/event/[eventId]
GET    /api/dashboard/workpack/[id]
GET    /api/dashboard/tenant                     org-wide KPIs
GET    /api/reporting/templates
POST   /api/reporting/templates
GET    /api/reporting/templates/[id]
PATCH  /api/reporting/templates/[id]
POST   /api/reporting/run                        ad-hoc
POST   /api/reporting/schedule                   recurring
GET    /api/export?type=workpacks|joints|blinds|punch|...
```

**UI**

- `/dashboard` — top-level
- `/reporting` — report builder, saved reports, scheduled distribution

---

### 3.23 Notifications

**Features**

- In-app notification bell (unread count, grouped)
- Email digests (daily / weekly, per-user prefs)
- Event types: approval requested, constraint raised, punch assigned, hold point ready, schedule slip > X, AI job complete
- Webhook out (customer webhook endpoint per tenant)

**Models:** `Notification`.

**Routes**

```
GET    /api/notifications                        list (unread first)
POST   /api/notifications/mark-read
GET    /api/notifications/[id]
PATCH  /api/notifications/[id]                   read / dismiss
DELETE /api/notifications/[id]
GET    /api/notifications/preferences
PATCH  /api/notifications/preferences
POST   /api/webhooks/out/test                    test customer webhook
```

**UI**

- Global bell icon, drawer
- `/settings/notifications` — prefs

---

### 3.24 Audit Log & Compliance

**Features**

- Every write captured (`AuditLog`): actor, target model+id, before → after, timestamp, IP
- Immutable store (append-only), export for audit
- Retention policy per tenant
- Tamper-evident hashing chain (optional)

**Models:** `AuditLog`.

**Routes**

```
GET    /api/audit?model=&id=                     filter
GET    /api/workpacks/[id]/audit
GET    /api/export/audit?from=&to=
```

**UI**

- `/settings/audit` — tenant-wide view
- `/workpacks/[id]` → **Audit** tab

---

### 3.25 Admin & System Operations

**Features**

- Health endpoint
- Cron endpoints (auth via header secret) for BullMQ scheduled jobs
- Webhook registry & delivery retry
- Rate limiter (`rate-limiter-flexible`)
- Email sending & email log
- System banner / maintenance mode
- Data export (tenant-wide) for GDPR / migration

**Routes**

```
GET    /api/health                                DB + redis + workers
GET    /api/system/version
POST   /api/cron/[task]                           header-auth cron
GET    /api/admin/onboarding
POST   /api/admin/onboarding
GET    /api/admin/email
POST   /api/admin/email/test
GET    /api/admin/backfill-activity-codes
POST   /api/admin/backfill-activity-codes
GET    /api/admin/role-check
GET    /api/proxy/[...path]                       controlled outbound proxy
POST   /api/webhooks/[source]                     inbound (whatsapp, sap, etc.)
POST   /api/export                                tenant export
```

**UI**

- `/admin` — system admin
- `/admin/system` — health, queues, workers
- `/admin/email` — email log

---

### 3.26 Integrations

**Features**

- **SAP** (materials, BOM, reservation sync — REST or IDoc bridge)
- **Primavera P6 / MS Project** (XER, XML import/export)
- **Outlook / Gmail / MS365** calendar + email
- **Slack / Teams** notifications
- **S3 / Azure Blob / GCS** file storage
- **DocuSign / Adobe Sign** for certificate signing (optional)
- **SSO** (Azure AD, Okta, Google Workspace)

**UI**

- `/settings/integrations` — one card per connector, connect / test / logs

---

## 4. Application Shell & Navigation

Top-level nav (filtered by permission + feature flag):

```
 AURIANOA OS
 ├── Dashboard
 ├── Events                (all events)
 │     ├── Overview
 │     ├── Safety
 │     ├── Schedule
 │     └── Reports
 ├── Planning              (scope, WBS, library)
 │     ├── Units
 │     ├── Systems
 │     ├── Joints
 │     └── Blinds
 ├── Asset Register
 ├── Workpacks             (main workhorse)
 ├── Schedule              (Gantt)
 ├── Constraints
 ├── Punch
 ├── Permits               (optional)
 ├── Documents
 ├── Shift Reports
 ├── Safety
 ├── WhatsApp Reviews
 ├── Lessons
 ├── Reporting
 ├── Settings              (org admin)
 │     ├── Organization
 │     ├── Users
 │     ├── Roles
 │     ├── Sites / Plants
 │     ├── Master Data
 │     ├── UDF Definitions
 │     ├── Templates
 │     ├── Certificates
 │     ├── Print
 │     ├── AI
 │     ├── Notifications
 │     ├── Integrations
 │     └── Audit
 └── Platform              (super-admin only)
       ├── Tenants
       ├── Feature Flags
       ├── Library
       ├── Billing
       └── System Health
```

---

## 5. Wireframe — key screens (ASCII)

### 5.1 Event Dashboard — `/events/[eventId]`

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Events  /  STO-2026 Q2 Hydrocracker            Status: Execution  │
│  Start 01-May   Planned End 28-May   Day 12 of 28   On track ▲ 2d    │
├──────────────────────────────────────────────────────────────────────┤
│  [Overview] [Scope] [Schedule] [Team] [Safety] [Reports] [Close-out] │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ Workpacks  │ │ Progress   │ │ Constraints│ │ Punch A    │         │
│  │   128 / 142│ │    62.4 %  │ │   17 open  │ │    23 open │         │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│                                                                      │
│  S-curve ──────────────────────────────────────────────               │
│  Plan vs Actual chart                                                 │
│                                                                      │
│  Critical Path Status            Resource Histogram                  │
│  (top 10 activities)             (by discipline, by day)             │
│                                                                      │
│  Safety: 0 LTI, 2 near-miss (7d)  |  Incidents → open                │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Workpack Detail — `/workpacks/[id]`

```
┌──────────────────────────────────────────────────────────────────────┐
│ WP-2026-HC-E101-0042   Shell & Tube E-101 Overhaul                   │
│ Status: In Progress  Progress 47%   Next hold: Hydro-test 2d         │
│ [Submit] [Print PDF] [Clone]                                         │
├──────────────────────────────────────────────────────────────────────┤
│ Overview | Activities | Materials | Tools | Constraints |            │
│ Joints | Blinds | Checklists | QA / Clearance | Documents |          │
│ Forms  | Certificates | Punch | Lessons | Attachments | Audit        │
├──────────────────────────────────────────────────────────────────────┤
│  (tab content — see below)                                           │
└──────────────────────────────────────────────────────────────────────┘
```

**Activities tab (inside workpack):**
```
[+ Add] [Import from library] [AI suggest]
┌────┬────────────────────────┬─────┬──────┬──────┬──────┬──────────┐
│ #  │ Activity                │ Dur │ Plan │ Act  │ %    │ Status   │
├────┼────────────────────────┼─────┼──────┼──────┼──────┼──────────┤
│ 10 │ Isolation & drain       │  8h │ 01   │ 01   │ 100% │ Done     │
│ 20 │ Blind install           │  6h │ 01   │ 02   │  90% │ In prog  │
│ 30 │ Dismantle shell         │ 24h │ 02   │  —   │   0% │ Pending  │
│ 40 │ NDT / inspection        │ 16h │ 04   │  —   │   0% │ Hold (W) │
│...                                                                │
└────┴────────────────────────┴─────┴──────┴──────┴──────┴──────────┘
   [ Gantt ▼ ]
```

**Joints tab:**
```
Joints (42)   [Import from line list] [+ Add] [Report ▼]
┌────┬────────┬───────┬──────┬──────┬──────┬───────┬───────┬────────┐
│ #  │ Line   │ Size  │ Spec │ Fit  │ Weld │ NDT   │ Hydro │ Status │
├────┼────────┼───────┼──────┼──────┼──────┼───────┼───────┼────────┤
│ 1  │ 6"-P-01│ 6"    │ A106 │  ✓   │  ✓   │   —   │   —   │ WIP    │
│ 2  │ 8"-P-02│ 8"    │ A106 │  ✓   │  ✓   │   ✓   │   ✓   │ Closed │
│...                                                                │
└────┴────────┴───────┴──────┴──────┴──────┴───────┴───────┴────────┘
```

### 5.3 Schedule (event-wide Gantt) — `/schedule`

```
Filter: [Event ▼] [Unit ▼] [Discipline ▼] [Crew ▼]  View: [Day|Week]
┌──────────────────┬───────────────────────────────────────────────┐
│ E-101 Overhaul   │ ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  47%  │
│  ├ Isolation     │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 100%  │
│  ├ Blind install │ ░██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  90%  │
│  ├ Dismantle     │ ░░░██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%   │
│  └ NDT           │ ░░░░░██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%   │
│ C-201 Tower      │ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  30%  │
│ ...                                                              │
└──────────────────┴───────────────────────────────────────────────┘
Critical path shown red.   Baseline vs Actual toggle.
```

### 5.4 Asset Register — `/asset-register`

```
┌───────────────────┐  ┌───────────────────────────────────────────┐
│  Plant tree       │  │  Asset: E-101 Feed/Effluent Exchanger     │
│  ▸ Site Jamnagar  │  │  Tag E-101   Unit CDU   System S-100      │
│    ▸ HCU          │  │  ─────────────────────────────────────    │
│      ▾ Unit CDU   │  │  Nozzles (12) | Lines (8) | Joints (42)   │
│        ▾ S-100    │  │  Drawings | Procedures | History          │
│          • E-101  │  │  [Start Workpack]  [Upload P&ID] [AI]     │
│          • P-101  │  │                                            │
│          • V-101  │  │  [tabs with tables & docs]                 │
│      ▸ Unit VDU   │  │                                            │
└───────────────────┘  └───────────────────────────────────────────┘
```

### 5.5 Punch Board — `/punch`

```
Event: STO-2026 Q2  [A: 23] [B: 47] [C: 12]         [Add] [Export]
┌──────────── A ────────────┬──────── B ────────┬──── C ──────────┐
│ #123 Leaking flange @ F-3 │ #201 Paint touch. │ #310 Label miss.│
│ #124 Torque verify        │ #202 Insulation   │ #311 ...        │
│ #125 Hydro re-test        │ ...               │                 │
└───────────────────────────┴───────────────────┴─────────────────┘
```

### 5.6 Shift Report — `/shift-reports`

```
Calendar:    [ May 2026  ]
Mon Tue Wed Thu Fri Sat Sun
  1   2   3   4   5   6   7       each cell → compiled HTML report
  8 [9]  10  11  12  13  14       clicking opens day view
...
```

### 5.7 Platform Super-Admin — `/platform`

```
Tenants (14)            [+ Add tenant]   [Search] [Plan ▼] [Status ▼]
┌──────────────┬─────────────┬──────────┬────────┬────────┬────────┐
│ Tenant        │ Plan        │ Users    │ Events │ AI $/mo│ Status │
├──────────────┼─────────────┼──────────┼────────┼────────┼────────┤
│ Reliance Jam. │ Enterprise  │ 210      │ 3      │ 1,240  │ Active │
│ Acme Refinery │ Standard    │  42      │ 1      │   180  │ Active │
│ DemoCo        │ Trial       │   5      │ 1      │     2  │ Trial  │
└──────────────┴─────────────┴──────────┴────────┴────────┴────────┘
```

---

## 6. Cross-cutting Technical Conventions

- **API contract** — every route returns `{ ok: boolean, data?, error?: { code, message, details } }`, uses Zod for input validation, wraps in `guardApi(permission)`, applies `orgScope(session)` before any DB call.
- **Pagination** — cursor `?cursor=&limit=` (max 100) on list routes; `?q=`, `?sort=`, `?filter[field]=` supported.
- **Attachments** — always S3 presigned flow: `POST /presign` → client PUTs → `POST /complete` → row saved with key + sha256.
- **Background jobs** — any task >1s goes on BullMQ (`src/workers/*`): extraction, PDF gen, schedule import, email blast, report run.
- **Realtime** — lightweight SSE channel per workpack for progress / AI job status; fallback to SWR polling.
- **File naming** — tenant-scoped S3 prefix `orgs/{orgId}/events/{eventId}/workpacks/{wpId}/...`
- **Testing** — `vitest` for units + services, route-level integration tests using seeded test tenant.
- **Observability** — structured logs, request ID, AI log, email log, audit log → all searchable.
- **Security** — every route RBAC-guarded + org-scoped; rate-limited; CSRF via next-auth; S3 presigned URLs short-lived (5 min); S3 bucket private; PII encrypted at rest; audit log append-only.

---

## 7. Feature → Prisma Model → API → UI Traceability Matrix

| Feature block | Prisma models (primary) | API prefix | Page(s) |
|---|---|---|---|
| Platform | Organization, BillingLog | `/api/admin/*`, `/api/central/*` | `/platform/*` |
| Auth | User, Role, UserRole | `/api/auth/*`, `/api/users/*` | `/login`, `/settings/users` |
| Org settings | Organization, Site, Plant, Discipline | `/api/settings/*` | `/settings/*` |
| Master data | ItemCatalog, GasketBoltLookup, ActivityLibrary, *Udf* | `/api/master-data/*` | `/settings/master-data/*` |
| Asset register | Unit, System, Asset, Nozzle, LineList, AssetLine, JointMaster | `/api/hierarchy`, `/api/units/*`, `/api/systems/*`, `/api/assets/*`, `/api/line-lists/*`, `/api/joint-masters/*`, `/api/asset-register/*` | `/asset-register/*`, `/planning/*` |
| Event | Event, EventUnit, EventSystem, Project | `/api/events/*`, `/api/projects/*` | `/events/*` |
| Schedule | Activity, ActivityRelationship, ActivityLibrary, ScheduleImportJob, ScheduleExportJob | `/api/activities`, `/api/schedule/*`, `/api/workpacks/[id]/activities/*` | `/schedule`, `/workpacks/[id]` (Activities) |
| Workpack | Workpack, WorkpackAttachment, WorkpackDocument, WorkpackVersion, WorkpackIdCounter, WorkpackTemplate | `/api/workpacks/*` | `/workpacks/*` |
| Joints | JointIntegrityItem, JointMaster | `/api/workpacks/[id]/joints/*`, `/api/joint-masters/*` | workpack Joints tab, `/planning/joints` |
| Blinds | Blind, SystemBlind | `/api/workpacks/[id]/blinds/*` | workpack Blinds tab, `/planning/blinds` |
| Checklists | DroppingBoxupChecklist(+Item), CleaningRecord, TemplateChecklistItem | `/api/workpacks/[id]/checklists/*`, `/api/workpacks/[id]/cleaning` | workpack Checklists tab |
| Clearance / QA | QaClearanceRecord, ClearanceForBoxup, ClearanceSignOff, OrgClearanceParty | `/api/workpacks/[id]/clearance-boxup/*`, `/api/admin/clearance-parties` | workpack QA tab |
| Certificates | JobCompletionCertificate, CertificateTemplate, CertificateInstance | `/api/workpacks/[id]/jcc`, `/api/workpacks/[id]/certificates/*`, `/api/certificate-templates` | workpack Certificates tab, `/settings/certificate-templates` |
| Punch | PunchListItem | `/api/workpacks/[id]/punch-list/*`, `/api/events/[eventId]/punch-list` | `/punch`, workpack Punch tab |
| Constraints | Constraint, ConstraintLog, ConstraintAttachment | `/api/workpacks/[id]/constraints/*`, `/api/events/[eventId]/constraints` | `/constraints`, workpack Constraints tab |
| Materials | WorkpackMaterial, WorkpackMaterialLine, ItemCatalog, GasketBoltLookup | `/api/workpacks/[id]/materials/*`, `/api/master-data/items` | workpack Materials tab |
| Tools | WorkpackTool | `/api/workpacks/[id]/tools/*` | workpack Tools tab |
| Documents / Forms | DocumentTemplate, DocumentInstance, FormTemplate(+Version), FormInstance, FormEntry, Attachment | `/api/documents/*`, `/api/workpacks/[id]/documents/*`, `/api/workpacks/[id]/attachments/*` | `/documents`, workpack Documents / Forms / Attachments tabs |
| Safety | SafetyLog, SafetyIncident, SafetyPhoto | `/api/events/[eventId]/safety/*` | `/safety`, `/events/[eventId]/safety` |
| Shift reports | ShiftReport, UnitShiftReportRecipient | `/api/shift-reports/*`, `/api/events/[eventId]/reports` | `/shift-reports` |
| Lessons | LessonsLearnt, LessonLearned, AiSuggestedItem | `/api/workpacks/[id]/lessons/*`, `/api/lessons` | `/lessons`, workpack Lessons tab |
| AI | AiProviderSetting, AiPrompt, AiLog, AiExtractionJob, AiExtractionResult, ExtractionConflict | `/api/ai-config`, `/api/ai-prompts/*`, `/api/ai-logs`, `/api/*/extract-*`, `/api/*/suggest-*` | `/settings/ai`, inline actions |
| WhatsApp | WhatsappSession, WhatsappUpdate | `/api/whatsapp/*`, `/api/webhooks/whatsapp` | `/whatsapp-reviews` |
| Notifications | Notification | `/api/notifications/*` | global bell, `/settings/notifications` |
| Audit | AuditLog | `/api/audit`, `/api/workpacks/[id]/audit` | `/settings/audit`, workpack Audit tab |
| Reporting | (query-only) | `/api/dashboard/*`, `/api/reporting/*`, `/api/export` | `/dashboard`, `/reporting` |

---

## 8. Roadmap proposal (suggested)

**Phase A — stabilise core (what exists)**
Workpack tabs consolidation, audit gaps from `MASTER_AUDIT_REPORT.md`, feature-flag table, platform-vs-tenant library split, full RBAC audit, Zod across all routes.

**Phase B — close execution gaps**
Dropping/Boxup + Clearance hardening, JCC, Punch board, Shift reports, Permits overlap.

**Phase C — scheduling depth**
P6/MSP XER import/export round-trip, critical path computation, baseline-vs-actual, resource-loading.

**Phase D — AI & mobile**
Extraction conflict UX, lessons suggestions, WhatsApp review queue, mobile-optimised workpack view, offline-first punch entry.

**Phase E — integrations & enterprise**
SAP, SSO (Okta/AAD), DocuSign, customer webhooks, data export, tenant-wide audit export, SOC-2 controls.

---

*End of draft. Next step: agree phasing + which gaps from the existing repo to close first — then I can produce a working backlog (tickets-ready) from this spec.*
