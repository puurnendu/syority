# Section 6 — Audit Report

## 1. PDF route — full file structure
- `app/api/workpacks/[id]/pdf/route.ts`: GET handler only; calls `PdfService.generateWorkpackPdf(id, orgId)`, returns blob. No inline PDF building; all content is in PdfService.

## 2. PDF route — bottom half
- Same file has no “bottom half”; single GET, ~25 lines.

## 3. MS Project stub
- **EXISTS:** `app/api/workpacks/[id]/export/ms-project/route.ts`
- Uses `getOrgIdFromRequest`, feature flag `can_export_xml`, `MsProjectXmlFormatter.format(workpack, udfDefinitions)`. Returns XML; not a 501 stub. Task 6B may replace with spec MSPDI or keep and align guard/permission.

## 4. Overview panel
- WorkpackTabs.tsx: `OverviewPanel` (line 143), case `'overview'` (1113) renders `<OverviewPanel workpack={workpack} />`. Refs to `planned_start_date`, `planned_end_date` (156–157, 243, 259). No WorkflowStatus/timeline component yet.

## 5. Settings
- `find app -path "*/settings*" -name "page.tsx"`: many (organization, sites, users, items, templates, print-settings, etc.).
- `app/(dashboard)/settings/page.tsx`: redirects to `/settings/organization`. No tab array; settings are separate routes. SettingsSidebar has sections (Organization, Master Data, System) with links.

## 6. Workpack list
- `app/(dashboard)/workpacks/page.tsx`: Server component; `WorkpackService.getWorkpacks(orgId)`; table with WP Number, Title, Site, Discipline, Status, Activities. No WorkpackCard; table rows with `<Link>` and status badge.

## 7. WorkpackCard / WorkpackRow / WorkpackList
- No matches in `src` — list is table-based in workpacks/page.tsx.

## 8. Activity model
- Activity: id, organization_id, workpack_id, activity_code, activity_number, description, duration_hours, planned_start, planned_end, actual_start, actual_end, progress_percent, status (ActivityStatus), notes, discipline relation, etc.

## 9. Workpack — status / progress
- Schema: planned_start_date, planned_end_date, status (WorkpackStatus), workpack_id_code. No `overall_progress` column; use optional/computed for UI.

## 10. CertificateTemplate
- is_platform, is_active, organization_id present (lines 2236–2243).

## 11. TypeScript baseline
- To run: `npx tsc --noEmit 2>&1 | grep "error TS" | wc -l` → 0 after changes.
