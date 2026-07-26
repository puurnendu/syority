# Full Duplication Audit Report

**Date:** 2025-03-03  
**Scope:** Data stored/managed in more than one place across the codebase. Audit only — no fixes applied.

---

## How the audit was run

- **Schema:** `prisma/schema.prisma` (grep and read).
- **Code:** Grep across `src`, `app` for discipline, hold_point, UDF usage, templates, activity_code, resources, clearance.
- **DB:** All audit SQL scripts in `scripts/audit/*.sql` were executed via `npx prisma db execute --stdin`. **Note:** `prisma db execute` does not return SELECT result sets; it only reports "Script executed successfully." To get row-level results (counts, comparison of discipline vs UDF, etc.), run the same SQL in your DB client (e.g. psql, DBeaver).

---

## AUDIT 1 — Discipline

**Verdict: POTENTIAL DUPLICATE**

- **Native field:** `Activity.discipline_id` → `Discipline` (schema lines 792–793). Also `Workpack.discipline_id`, `ActivityLibrary.discipline_id`, etc.
- **UDF:** Code references a UDF with `code = 'discipline'`:
  - `WorkpackTemplatesClient.tsx`: when selecting an activity code, sets `udf.discipline = code.discipline_code` and passes `udf_defaults` (which can include `discipline`).
  - `ActivitiesPanel.tsx`: column type `'discipline_select'` bound to field `'discipline_id'` (native), and `DEFAULT_VISIBLE_UDF_CODES` includes `'discipline'`, so discipline can be shown/edited as both native and UDF.
- **Conclusion:** Discipline can be stored in two places: (1) `Activity.discipline_id`, (2) `ActivityUdfValue` for definition with `code = 'discipline'`. To confirm duplication in data, run in DB:

```sql
-- scripts/audit/audit1d_discipline_compare.sql
SELECT a."discipline_id", uv.value_string, COUNT(*) AS cnt
FROM "Activity" a
LEFT JOIN "ActivityUdfValue" uv ON uv.activity_id = a.id
LEFT JOIN "ActivityUdfDefinition" ud ON ud.id = uv.udf_definition_id AND ud.code = 'discipline'
WHERE a.deleted_at IS NULL
GROUP BY 1, 2 ORDER BY cnt DESC LIMIT 20;
```

---

## AUDIT 2 — UDFs vs model fields

**Verdict: LIST OF POTENTIAL OVERLAPS (schema + code)**

- **Activity** has native columns including: `discipline_id`, `hold_point_type`, `hold_point_description`, `work_category`, `activity_number`, `description`, `duration_hours`, `planned_start`, `planned_end`, `status`, `notes`, etc.
- **Workpack** has: `discipline_id`, `asset_id`, `equipment_type`, `job_type`, `contractor_id`, `work_type`, `priority`, etc.
- **ActivityUdfDefinition** holds org-specific UDFs by `code` (e.g. `discipline`, `hold_point_ts`, `hold_point_ai`, `welding_qty`, `scaffolding_qty`, `permit_type`, `phase`).
- **Code evidence:** `ActivitiesPanel` uses both:
  - Native: `discipline_id`, `hold_point_type`, `work_category`, etc.
  - UDFs: `DEFAULT_VISIBLE_UDF_CODES = ['discipline', 'hold_point_ts', 'hold_point_ai', 'welding_qty', ...]`.
- **Matches to check in DB:** Run cross-reference query (e.g. `scripts/audit/audit2_crossref.sql`) in your client. UDF codes that align with model concepts:
  - **discipline** ↔ `Activity.discipline_id`, `Workpack.discipline_id`
  - **hold_point_ts / hold_point_ai** ↔ `Activity.hold_point_type` (and possibly `hold_point_description`)
- **Full UDF list:** Run `scripts/audit/audit2_udf_list.sql` in DB to get current `code`, `name`, `type`, `is_mandatory`, `is_active`.

---

## AUDIT 3 — Hold point

**Verdict: POTENTIAL DUPLICATE**

- **Native:** `Activity.hold_point_type`, `Activity.hold_point_description` (schema ~804–805). Same on `ActivityLibrary` (~1739–1740).
- **UDFs:** `ActivitiesPanel` exposes UDFs `hold_point_ts` and `hold_point_ai` in `DEFAULT_VISIBLE_UDF_CODES`.
- **Conclusion:** Hold point can exist in (1) native `hold_point_type` / `hold_point_description` and (2) UDF values for `hold_point_ts` and/or `hold_point_ai`. To see overlap in data, run `scripts/audit/audit3_hold_compare.sql` in your DB client.

---

## AUDIT 4 — Templates

**Verdict: CLEAN (no org vs platform template duplication)**

- **Schema:** No `templates` or `platform_templates` tables. Only:
  - `WorkpackTemplate` (map: `workpack_templates`)
  - `WorkpackTemplateActivity` (`workpack_template_activities`)
  - `FormTemplate`, `FormTemplateVersion`
  - `DocumentTemplate`
- **Conclusion:** Single template model per purpose (workpack vs form vs document). No duplicate “org templates” vs “platform templates” in this codebase.

---

## AUDIT 5 — Activity codes

**Verdict: N/A (no separate activity_codes / platform_activity_codes tables)**

- **Schema:** No `activity_codes` or `platform_activity_codes` table. “Activity codes” in the app are implemented as **ActivityLibrary** (code/name/description/discipline/duration/hold_point, etc.).
- **WorkpackTemplateActivity** has an `activity_code` string and links to `ActivityLibrary` via template flow; there is no second copy of the same codes in another table.
- **Conclusion:** No org vs platform activity-code duplication; single source (ActivityLibrary).

---

## AUDIT 6 — Equipment tag / asset tag

**Verdict: POTENTIAL DUPLICATE (if UDFs exist)**

- **Native:** `Workpack.asset_id` (→ Asset), `Workpack.equipment_type`, `Workpack.job_type`.
- **UDFs:** If `ActivityUdfDefinition` has codes such as `equipment_tag`, `asset_tag`, `drawing_number`, `contractor`, `responsible_party`, those could duplicate or overlap with workpack-level asset/equipment data (or activity-level representation).
- **Check:** Run `scripts/audit/audit6_udf_equipment.sql` and `audit6_workpack_asset.sql` in DB to list UDFs and workpack columns; then compare usage in UI/API.

---

## AUDIT 7 — Resources

**Verdict: CLEAN (different domains)**

- **Resource:** People/craft/contractors (ResourceType, Contractor, labor assignment).
- **item_catalog:** Materials (gasket, bolt, consumable, tool, etc.).
- **Conclusion:** Resources = labor; item_catalog = materials. No structural duplication. Overlap only if “tools” are both in Resource and in item_catalog with category `tool`; that would be a semantic overlap to document, not a storage duplicate.

---

## AUDIT 8 — Clearance parties vs QA records

**Verdict: CLEAN (distinct purposes)**

- **Tables:** `org_clearance_parties` (party definitions), `clearance_for_boxup`, `clearance_sign_offs`, `qa_clearance_records`, etc.
- **Conclusion:** Different tables for different concepts (who can sign, boxup clearance state, sign-off events, QA clearance records). No evidence of the same data stored in two places.

---

## AUDIT 9 — Table list with sizes

**Note:** `npx prisma db execute --stdin` does not return SELECT output. To get table list with row estimates and sizes, run the following in your PostgreSQL client (e.g. psql):

```sql
-- scripts/audit/audit9_all_tables.sql
SELECT
  t.table_name,
  COALESCE(s.n_live_tup::bigint, 0) AS row_count_estimate,
  pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS total_size
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
ORDER BY pg_total_relation_size(quote_ident(t.table_name)) DESC NULLS LAST;
```

If your tables use quoted PascalCase names (e.g. `"Activity"`), ensure `quote_ident(t.table_name)` matches your actual relation names (you may need to use the relation name from `pg_stat_user_tables` or a case-aware expression). Paste the full output of this query into your report for AUDIT 9.

---

## AUDIT 10 — Source code size

**Result (run on project root):**

- **Source files (ts/tsx/prisma):** 259  
- **Total size:** 1.39 MB  
- **Excluded:** `node_modules`, `.next` (implied by path filters).

---

## Summary table

| Audit | Topic              | Verdict              | Action |
|-------|--------------------|----------------------|--------|
| 1     | Discipline         | POTENTIAL DUPLICATE  | Confirm in DB; consider single source (native or UDF). |
| 2     | UDFs vs model      | List overlaps        | Run audit2 SQL in client; reconcile discipline & hold_point. |
| 3     | Hold point         | POTENTIAL DUPLICATE  | Confirm in DB; unify with native or remove UDFs. |
| 4     | Templates          | CLEAN                | None. |
| 5     | Activity codes     | N/A                  | No duplicate tables. |
| 6     | Equipment/asset tag | POTENTIAL DUPLICATE  | If UDFs exist, compare with Workpack.asset_id / equipment_type. |
| 7     | Resources          | CLEAN                | None. |
| 8     | Clearance parties  | CLEAN                | None. |
| 9     | Table list         | Run in DB client     | Paste full output for record. |
| 10    | Source code size   | 259 files, 1.39 MB   | None. |

---

## Audit SQL scripts (run in DB client for row-level results)

All under `scripts/audit/`:

- `audit1b_udf_discipline.sql` — UDF definition with code = 'discipline'
- `audit1c_activity_columns.sql` — Activity columns containing 'discip'
- `audit1d_discipline_compare.sql` — Compare activity discipline_id vs UDF discipline value
- `audit2_udf_list.sql` — All UDF definitions
- `audit2_activity_columns.sql` / `audit2_workpack_columns.sql` — Activity/Workpack columns
- `audit2_crossref.sql` — UDF codes that match activity/workpack column names
- `audit3_hold_columns.sql` / `audit3_udf_hold.sql` / `audit3_hold_compare.sql` — Hold point native vs UDF
- `audit4_tables.sql` — Tables with 'template' in name
- `audit5_tables.sql` — Tables with 'activity_code' in name
- `audit6_workpack_asset.sql` / `audit6_udf_equipment.sql` — Asset/equipment/tag columns and UDFs
- `audit7_tables.sql` / `audit7_counts.sql` — Resource tables and counts vs item_catalog
- `audit8_tables.sql` — Clearance/party tables
- `audit9_all_tables.sql` — All tables with size/row estimate
