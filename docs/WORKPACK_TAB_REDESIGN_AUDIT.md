# Workpack Tab Redesign — Master Audit Report

**Date:** 2025-03-03

---

## 1. Current workpack detail page — tabs array

**File:** `app/(dashboard)/workpacks/[id]/page.tsx`  
- Page does **not** define tabs inline. It uses `<WorkpackHeader>` and `<WorkpackTabs workpack={...} udfDefinitions={...} />`.
- Tabs are defined in **`src/components/Workpack/WorkpackTabs.tsx`** in the `TABS` constant.

**TABS in WorkpackTabs.tsx (18 items):**

| # | id | label | icon |
|---|-----|--------|------|
| 1 | overview | Overview | 📋 |
| 2 | activities | Activities | 📝 |
| 3 | joints | Joint Register | 🔩 |
| 4 | blinds | Blind Register | 🚫 |
| 5 | constraints | Constraint Log | ⚠️ |
| 6 | materials | Materials | 📦 |
| 7 | punch | Punch List | ✅ |
| 8 | dropping | Dropping/Boxup | 📦 |
| 9 | clearance | Clearance | 🔓 |
| 10 | cert-boxup | Boxup Cert | 📜 |
| 11 | cert-torque | Torque Cert | 🔧 |
| 12 | cert-hydro | Hydro Cert | 💧 |
| 13 | cleaning | Cleaning | 🧽 |
| 14 | jcc | Completion | 🏆 |
| 15 | lessons | Lessons | 💡 |
| 16 | documents | Documents | 📁 |
| 17 | audit | Audit Log | 🔍 |
| 18 | workflow | Workflow | 🔄 |

Panels also reference `forms` and `attachments` (no tab buttons for them in TABS). **Effective visible tabs: 18.**

---

## 2. All workpack tab components

**Found (project root, excluding node_modules/.next):**

- `src/components/Workpack/WorkpackTabs.tsx` — main tab container + inline panels (Overview, Joints, Blinds, Constraints, Punch, Workflow, Documents, Attachments, Audit).
- `src/components/Workpack/tabs/MaterialsTab.tsx` — materials tab.

**Other panels (imported in WorkpackTabs):**

- `ActivitiesPanel` — from `./ActivitiesPanel`
- `DroppingBoxupPanel` — from `./DroppingBoxupPanel`
- `ClearancePanel` — from `./ClearancePanel`
- `FlangeBoxupCertPanel`, `TorqueCertPanel`, `HydrotestCertPanel` — cert panels
- `CleaningPanel` — from `./CleaningPanel`
- `JobCompletionPanel` — from `./JobCompletionPanel`
- `LessonsLearntPanel` — from `./LessonsLearntPanel`
- `MaterialsTab` — from `./tabs/MaterialsTab`
- `JointsPanel`, `BlindsPanel`, `ConstraintsPanel`, `PunchListPanel`, `WorkflowPanel`, `DocumentsPanel`, `AttachmentsPanel` — defined or imported in WorkpackTabs.

---

## 3. Schema — Workpack model

**Location:** `prisma/schema.prisma` starting at line 660.

**Current Workpack fields (summary):**

- id, organization_id, site_id, workpack_number (String? @unique), title, revision, sap_work_order, sap_notification, sap_plant_maintenance_order, asset_id, unit_id, discipline_id, contractor_id, work_type, priority, scope_of_work, planned_start_date, planned_end_date, estimated_manhours, status, is_locked, locked_at, locked_by, created_by, updated_by, created_at, updated_at, deleted_at.
- V5: template_id, equipment_type, job_type, approval_status, approval_submitted_at, approval_decided_at, approved_by_name, approved_by_email, approval_notes.

**Missing for redesign (1A):** workpack_id_code (@unique), unit_code (or keep unit_id only), portfolio_id.

---

## 4. Schema — constraint / lesson / certificate / punch

- **Constraint** — line 1529 (existing; workpack-level constraint log).
- **PunchListItem** — line 1573.
- **JobCompletionCertificate** — line 2123.
- **LessonsLearnt** — line 2154.

No existing **CertificateTemplate** or **CertificateInstance**. No **ConstraintLog** (task adds new one). No **WorkpackIdCounter**.

---

## 5. Existing workpack number / ID generation

- **`src/modules/Workpack/Services/WorkpackService.ts`:**  
  - `generateWorkpackNumber(orgId)` — returns prefix + year + zero-padded sequence (e.g. WP-2025-00001).  
  - Used in `createWorkpack` when status is not `pending_ai_review`.  
  - No `generateWorkpackId`; no FCC-MEC-001 style.
- **`app/api/workpacks/route.ts`:** POST uses WorkpackService; no direct workpack_number/WP-/auto-number grep matches in route.ts (generation is in service).
- **References:** `app/api/workpacks/[id]/pdf/route.ts`, `materials/export/route.ts`, `export/ms-project/route.ts`, `export/activities-excel/route.ts` use `workpack_number` for display/filename.

---

## 6. Current overview tab

- **Overview** is implemented as **OverviewPanel** inside `WorkpackTabs.tsx` (inline function component).
- No separate file named `*Overview*Tab*`. Overview content: Workpack Number, Revision, SAP Work Order, SAP Notification, Work Type, etc. (read-only fields in a grid).

---

## 7. Activities tab — current XML export

- **`src/components/Workpack/tabs/`:** Only `MaterialsTab.tsx` in tabs folder. Activities live in `ActivitiesPanel.tsx`.
- **Grep (xml | msproject | primavera | export) in `src/components/Workpack/tabs/`:** Only MaterialsTab references `export` (materials export). No XML/msproject/primavera in tabs folder.
- **MS Project export:** `app/api/workpacks/[id]/export/ms-project/route.ts` exists. Activities Excel: `app/api/workpacks/[id]/export/activities-excel/route.ts`. No primavera route found under workpacks.

---

## 8. Materials tab — current search

- **File:** `src/components/Workpack/tabs/MaterialsTab.tsx`
- **Search/catalog:** `searchItem` state; when `searchItem.length < 2` catalog not fetched; debounced fetch to `/api/master-data/items?search=...&limit=10`; `catalogResults` shown in dropdown; user can pick item (fills item_catalog_id, description, etc.) or use free-text. So: separate search box + results dropdown, not inline autocomplete on description.

---

## 9. Existing central registers

- **`app/api/workpacks/[id]/constraints/route.ts`** — workpack-level constraints.
- **`app/api/workpacks/[id]/lessons-learnt/route.ts`** and **`.../lessons-learnt/[lessonId]/route.ts`** — workpack-level lessons.
- No `app/api/central/...` or route containing "central" found. No central register API yet.

---

## 10. TypeScript error baseline

- **Command:** `npx tsc --noEmit 2>&1 | grep "error TS"` (or PowerShell Select-String "error TS")
- **Result:** **0 errors** (exit code 0, no "error TS" lines).

---

## Summary

| Item | Result |
|------|--------|
| Tab count | 18 visible tabs in TABS array |
| Tab components | WorkpackTabs (inline panels) + MaterialsTab; others as Panel components |
| Workpack schema | Has workpack_number, sap_work_order, unit_id, discipline_id; missing workpack_id_code, unit_code, portfolio_id |
| Constraint/Lesson/Cert/Punch | Constraint, PunchListItem, JobCompletionCertificate, LessonsLearnt exist; no CertificateTemplate/Instance, no ConstraintLog, no WorkpackIdCounter |
| ID generation | generateWorkpackNumber (WP-YEAR-NNNNN); no FCC-MEC-001 style |
| Overview | Inline OverviewPanel in WorkpackTabs |
| Activities export | MS Project + activities-excel routes exist; no primavera in workpacks |
| Materials search | Separate search box + catalog dropdown (≥2 chars); not inline autocomplete |
| Central registers | Only workpack-scoped constraint/lesson APIs; no central API |
| TS errors | 0 |
