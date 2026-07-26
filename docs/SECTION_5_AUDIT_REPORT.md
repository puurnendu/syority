# Section 5 — Audit Report (Complete Output)

## 1. Certificate templates — any seeded already?

```bash
npx prisma db execute --stdin <<'SQL'
  SELECT id, cert_name, cert_type, equipment_types, is_active
  FROM certificate_templates LIMIT 20;
SQL
```

**Output (Windows):** `Script executed successfully.` (Prisma db execute does not stream SELECT results to stdout on this setup.)

**Schema check:** `certificate_templates` table exists. CertificateTemplate has: cert_type, cert_name, equipment_types (String[]), fields (Json), is_active, is_platform, **version (Int)**. Seed script will use version: 1 (integer).

---

## 2. Main nav component location

**find result (src/app, .tsx):**
- `src/components/Navigation/SettingsSidebar.tsx` (settings only)
- `app/(dashboard)/layout.tsx` — **main nav**: top header with `allNavLinks` array and `<Link>` items (Dashboard, Workpacks, Schedule, Billing, Portfolio, Operations, Settings, Admin). No Sidebar/NavBar/DashboardNav component; nav is inline in layout.

**Nav items section (layout.tsx):** `allNavLinks` array lines 16–24; render at 39–47 with `navLinks.map(link => <Link ...>)`. No Constraints or Lessons links. No badge support.

---

## 3. Create workpack modal — equipment_type?

**grep -n equipment_type|equipment in WorkpackCreateForm.tsx:**
- Line 79: `equipmentDrawingFile` (file state)
- Line 157: `equipmentDrawingFile` in form append
- Line 411: `equipmentDrawingFile` display

**Result:** No `equipment_type` field. Only "Equipment Drawing" file upload. **5C required: add Equipment Type select.**

---

## 4. Summary counts route — exists?

**find app/api -path "*summary-counts*" -name "route.ts"**

**Result:** `app/api/workpacks/[id]/summary-counts/route.ts` **EXISTS.**

Returns: open_constraints, open_hold_points (via Activity hold_point_type + qa_clearances), pending_certs. Uses guardApi, orgScope, correct model names.

---

## 5. Uploads serving route — exists?

**find app/api -path "*uploads*" -name "route.ts"**

**Result:** **No file found.** No `app/api/uploads/[...path]/route.ts` or similar. (Documents may be served via workpacks/[id]/documents/[docId] or other route.)

---

## 6. QA model name — for summary counts

**grep ^model Qa|HoldPoint|QaClearance prisma/schema.prisma:**
- `model QaClearanceRecord` (line 2016)

No `Qa` or `HoldPoint` model. Summary-counts route uses `Activity` with `hold_point_type` and `qa_clearances: { none: {} }` for open hold points — not QaClearanceRecord. **5D:** Leave as-is unless spec requires different model.

---

## 7. Central pages registered in nav or layout?

**grep -rn "constraints|lessons" app/(dashboard)/layout.tsx:**
- No matches. **Constraints and Lessons are NOT in the dashboard layout nav.** 5B will add them.

---

## 8. Features constants file

**cat src/lib/features.ts | grep -A 2 "WP_TAB|FEATURES"**
- **File not found:** `src/lib/features.ts` does not exist. No WP_TAB/FEATURES constants found in src.

---

## 9. TypeScript baseline

**npx tsc --noEmit 2>&1 | grep "error TS" | wc -l**

**Before fix:** 1 error (closure-report route — PDF body type).
**After fix:** 0 errors (fixed by returning `new NextResponse(new Blob([pdf]), { headers })`).

---

## Summary

| Item                    | Status |
|-------------------------|--------|
| Certificate templates   | Table exists; seed script to be run (5A) |
| Main nav                | In `app/(dashboard)/layout.tsx`; add Constraints + Lessons with badges (5B) |
| Equipment type on create| Missing; add in WorkpackCreateForm (5C) |
| Summary counts API      | Exists; verify only (5D) |
| Uploads route          | Not present (optional for this section) |
| QA model                | QaClearanceRecord; summary uses Activity hold points |
| Central in nav          | Not present; 5B adds |
| features.ts             | Not found |
| TypeScript              | 0 errors after closure-report fix |

---

## Section 5 Implementation Complete

- **5A:** `prisma/seed-certificate-templates.ts` created; npm script `seed:cert-templates` added; seed run — 6 templates created (hydrotest_shell, hydrotest_tube, hydrotest_final, boxup, torque, reinstatement). Schema uses `version` as Int (1).
- **5B:** `app/api/nav/counts/route.ts` returns `open_constraints`, `draft_lessons`. `DashboardNavLinks` client component added; layout updated with Constraints + Lessons Learned links and badge state; badges render (red/amber).
- **5C:** Equipment Type state + fetch from `/api/certificate-templates`; select (with “Other”) added after Discipline, before Workpack ID; `equipment_type` included in POST body; `WorkpackService.createWorkpack` and Prisma create updated to persist `equipment_type`.
- **5D:** `app/api/workpacks/[id]/summary-counts/route.ts` verified — returns open_constraints, open_hold_points (via Activity), pending_certs.
- **5E:** `npx tsc --noEmit` — 0 errors. `npm run build` — success (exit 0).
