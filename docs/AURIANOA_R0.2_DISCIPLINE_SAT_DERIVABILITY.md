# AURIANOA R0.2 — Discipline / SAT derivability census

**Mode:** READ-ONLY. No Activity, Workpack, library, SAT, or Discipline row was updated.  
**Database:** `syority` (2026-09-09)  
**Population:** all **72** live Activities (`deleted_at IS NULL`)  
**Machine-readable mapping:** `var/r02-identity-backfill/discipline-sat-candidate-mapping.json`

---

## Verdict

Discipline and Standard Activity Type are **genuinely unavailable for automatic backfill on every live row**.

They are **not** sitting behind unused FKs that R0.2 simply failed to read. The authoritative sources R0.1 / `ControlledValueResolver` actually use are empty on these rows.

| Row class | Count | Meaning |
|---|---:|---|
| **AUTO_SAFE** | **0** | Unique + valid now, same rules as R0.1/R0.2. None. |
| **DERIVABLE_AFTER_MASTER_MAPPING** | **5** | Discipline only, and only if a new governed WP-prefix map is approved. SAT still empty. |
| **AMBIGUOUS** | **11** | More than one legitimate candidate, or a prefix that would invent a discipline. |
| **INSUFFICIENT_DATA** | **56** | No unique governed path. |

| Field | AUTO_SAFE | DERIVABLE_AFTER_MASTER_MAPPING | AMBIGUOUS | INSUFFICIENT_DATA |
|---|---:|---:|---:|---:|
| Discipline | 0 | 5 | 10 | 57 |
| SAT | 0 | 0 | 1 | 71 |

---

## What was actually present

| Source R0.1 would use | Live count on the 72 |
|---|---:|
| `Activity.discipline_id` | 0 |
| `Activity.standard_activity_type_id` | 0 |
| `Activity.activity_library_id` | 0 |
| `Workpack.discipline_id` | 0 |
| `Workpack.equipment_type` | 0 |
| `Workpack.template_id` | 0 |
| `Workpack.asset_id` (on these 72) | 0 |
| `Event.discipline_id` | 0 |
| `workpack_templates` rows in DB | 0 |
| `workpack_template_activities` rows | 0 |

Catalogs that **do** exist (mostly one tenant):

| Catalog | Count | Scope |
|---|---:|---|
| Discipline | 10 | **1 of 12** orgs that have live Activities (`2a8506b1-…` only) |
| Activity Library (with `activity_code`) | 250 | Codes are `ACT-MECH-0001` … `ACT-QAQC-…`, **not** `ACT-001` |
| Standard Activity Type | 54 | Always keyed by `equipment_type_id` |
| Equipment Type | 110 | Present; unused by these workpacks |
| Assets tagged HX-101 / V-201 / E-301 | **0** | |

`work_category` values `EXECUTION` / `LOE` / `MILESTONE` are schedule classes. They are **not** disciplines.

---

## Classification rules (no guessing)

**AUTO_SAFE** — existing valid FK, or unique same-tenant Workpack / template / linked-library discipline, or `ControlledValueResolver.resolveStandardActivity(equipmentTypeId, code)` with exactly one hit.

**DERIVABLE_AFTER_MASTER_MAPPING** — one unique tenant-valid candidate exists **after** an explicit new governed map that current code does not apply. Example: approve `WP-MECH-*` → Discipline `MECH` (that code is unique in the tenant).

**AMBIGUOUS** — two or more valid candidates, or a string that would require choosing (Electrical vs Instrumentation; Leak Test on three equipment types; WP-SUPP → SCAF would mis-label crane/milestone/safety rows).

**INSUFFICIENT_DATA** — no unique hook. Includes: tenant has no Discipline catalog; `ACT-001` is not a library code (`ACT-MECH-0001` is); UUID / `TEST-ACT-*` / `EVM-A*` / `CRIT-1` numbers; description that is not an exact unique SAT name **and** proven equipment type; SAT name that is unique in the catalog but scoped to the wrong equipment family.

SAT is equipment-typed. A catalog-unique name is not enough. Example: “Tube Replacement” exists once, as `TUBE_REPL` on **Fired Heater (`HTR-FH`)**. Applying that to `HX-101 Tube Replacement` would attach a heater SAT to exchanger wording. That was recorded as a **rejected** candidate, not a mapping.

`ACT-*` activity numbers are the **library** namespace. They are never treated as SAT codes.

---

## Candidate mapping (non-empty only)

### DERIVABLE_AFTER_MASTER_MAPPING — 5 rows

All on `WP-EVM-1` / title `WP-MECH-001: Heat Exchanger Retube`, org `2a8506b1-…`. Tenant has exactly one `MECH` (`5ab94e39-…`).

| Activity | Number | Description | Discipline candidate | SAT candidate |
|---|---|---|---|---|
| `d5cc7e0a-…` | EVM-A001 | HX-101 Shell Side Cleaning | **MECH** after `WP-MECH → MECH` map | none (`Cleaning` SAT exists on HEX-ST **and** VSL-PV) |
| `d35acf37-…` | EVM-A002 | HX-101 Tube Bundle Extraction | **MECH** same map | none (not exact SAT name; `Bundle Pullout` is different text) |
| `6d5ea293-…` | EVM-A003 | HX-101 NDE Inspection | **MECH** same map | none (`Inspection` is 6 equipment types; remainder is `NDE Inspection`) |
| `ee2868d6-…` | EVM-A004 | HX-101 Tube Replacement | **MECH** same map | **rejected** `TUBE_REPL` (Fired Heater only; no HX-101 asset) |
| `3a03f178-…` | EVM-A005 | HX-101 Hydro Test | **MECH** same map | none |

Required mapping (not implemented, not applied):

`Workpack.workpack_number / title` prefix `WP-MECH` → tenant Discipline `MECH`, unique.

Without that approved map these five stay unresolved. SAT still needs equipment type + governed SAT code.

### AMBIGUOUS — 11 rows

| Activity | Number | Description | Why |
|---|---|---|---|
| `cc1e294d-…` | EVM-A009 | V-201 Leak Test | Remainder `Leak Test` = SAT on HEX-ST, COL-DS, VSL-PV. WP-PIPE is not a Discipline code. |
| `bbdff2fa-…` | EVM-A011 | E-301 Motor Overhaul | Pack title is Electrical **and** Instrumentation (`ELEC` and `INST` both exist). |
| `8352617b-…` | EVM-A012 | E-301 Cable Re-termination | same pack |
| `ce55a014-…` | EVM-A013 | Instrument Calibration Batch 1 | same pack |
| `aeb2cd61-…` | EVM-A014 | DCS Point-to-Point Check | same pack |
| `f769fc26-…` | EVM-A015 | Scaffolding Erection - Area A | `WP-SUPP → SCAF` would be an assumption; pack also has crane / milestone / safety. |
| `fa1abd63-…` | EVM-A016 | Scaffolding Standby Crew | same |
| `8d974797-…` | EVM-A017 | Mechanical Completion Milestone | `SCAF` would be wrong |
| `2ad8df74-…` | EVM-A018 | Safety Walkdown | same |
| `0ef0bd3d-…` | EVM-A019 | Ready for Oil-In | same |
| `64492a92-…` | EVM-A020 | Crane Availability (LOE) | same |

WP-PIPE-001 (four sibling rows besides Leak Test) is **INSUFFICIENT_DATA** for discipline: tenant has no `PIPE` code. Not mapped to `MECH`.

### INSUFFICIENT_DATA — 56 rows

Grouped; every row in the JSON has the same field-level result (both INSUFFICIENT unless noted above).

| Group | n | Tokens | Why unavailable |
|---|---:|---|---|
| Phase 2C test pack | 11 | `TEST-ACT-*`, UUID numbers, `ACT-001/002/003` | `ACT-001` ≠ library `ACT-MECH-0001`. No template, no library FK, no equipment. |
| WP-PIPE-001 (non-leak) | 4 | EVM-A006…A008, A010 | No `PIPE` discipline. No unique SAT. No V-201/V-202 asset. |
| CPM fixtures (5 orgs × 4) | 20 | CRIT-1, NC-1, NC-2, SINK | Test text. Those orgs have **no** Discipline catalog. |
| M10-R3 WP-A/B/C/D | 16 | WP-A Act 1 … WP-D Act 3 | Org `bfd38393-…` has no Discipline rows. No library/SAT/eq. |
| Other single test acts | 5 | Test Activity 1, Weld Pipes, Install Piping | No codes, no FKs, or no tenant Discipline catalog. |

`ACT-001` / `ACT-002` / `ACT-003` were checked against the 250 library codes. They do not match. They must not be stretched to `ACT-MECH-0001`.

---

## Full row index (72)

| # | Activity (8) | Workpack | Number | Description | Disc | SAT | Row |
|---:|---|---|---|---|---|---|---|
| 1 | e5303f4d | Test WP | — | Test Activity 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 2 | 0fa2ece9 | TEST-WP-PH2C | (uuid) | Test Act 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 3 | 2631d18f | TEST-WP-PH2C | (uuid) | Test Act 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 4 | bc3194a4 | TEST-WP-PH2C | (uuid) | Test Act 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 5 | 92de3f4f | TEST-WP-PH2C | (uuid) | Test Act 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 6 | 89000000…0011 | TEST-WP-PH2C | ACT-001 | Primary Column High-Pressure Welding | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 7 | 89000000…0012 | TEST-WP-PH2C | ACT-002 | Reboiler Flange Alignment & Fitting | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 8 | 89000000…0013 | TEST-WP-PH2C | ACT-003 | Exchanger Bundle Rigging & Fitup | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 9 | 32292bf3 | TEST-WP-PH2C | (uuid) | Test Act 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 10 | 6013f710 | TEST-WP-PH2C | (uuid) | Test Act 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 11 | e61fd131 | TEST-WP-PH2C | TEST-ACT-1 | Test Act 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 12 | bd1b6ada | TEST-WP-PH2C | TEST-ACT-2 | Test Act 2 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 13 | d5cc7e0a | WP-EVM-1 | EVM-A001 | HX-101 Shell Side Cleaning | **MAP→MECH** | INSUFFICIENT | DERIVABLE_AFTER_MASTER_MAPPING |
| 14 | d35acf37 | WP-EVM-1 | EVM-A002 | HX-101 Tube Bundle Extraction | **MAP→MECH** | INSUFFICIENT | DERIVABLE_AFTER_MASTER_MAPPING |
| 15 | 6d5ea293 | WP-EVM-1 | EVM-A003 | HX-101 NDE Inspection | **MAP→MECH** | INSUFFICIENT | DERIVABLE_AFTER_MASTER_MAPPING |
| 16 | ee2868d6 | WP-EVM-1 | EVM-A004 | HX-101 Tube Replacement | **MAP→MECH** | INSUFFICIENT (TUBE_REPL rejected) | DERIVABLE_AFTER_MASTER_MAPPING |
| 17 | 3a03f178 | WP-EVM-1 | EVM-A005 | HX-101 Hydro Test | **MAP→MECH** | INSUFFICIENT | DERIVABLE_AFTER_MASTER_MAPPING |
| 18 | 1834863f | WP-EVM-2 | EVM-A006 | V-201 Isolation & Drain | INSUFFICIENT (no PIPE) | INSUFFICIENT | INSUFFICIENT_DATA |
| 19 | 8cbba374 | WP-EVM-2 | EVM-A007 | V-201 Valve Removal | INSUFFICIENT (no PIPE) | INSUFFICIENT | INSUFFICIENT_DATA |
| 20 | 3d0e4490 | WP-EVM-2 | EVM-A008 | V-201 New Valve Install | INSUFFICIENT (no PIPE) | INSUFFICIENT | INSUFFICIENT_DATA |
| 21 | cc1e294d | WP-EVM-2 | EVM-A009 | V-201 Leak Test | INSUFFICIENT (no PIPE) | **AMBIGUOUS** (3 eq types) | AMBIGUOUS |
| 22 | c7f9073f | WP-EVM-2 | EVM-A010 | V-202 Gate Valve Replacement | INSUFFICIENT (no PIPE) | INSUFFICIENT | INSUFFICIENT_DATA |
| 23 | bbdff2fa | WP-EVM-3 | EVM-A011 | E-301 Motor Overhaul | **AMBIGUOUS** ELEC/INST | INSUFFICIENT | AMBIGUOUS |
| 24 | 8352617b | WP-EVM-3 | EVM-A012 | E-301 Cable Re-termination | **AMBIGUOUS** ELEC/INST | INSUFFICIENT | AMBIGUOUS |
| 25 | ce55a014 | WP-EVM-3 | EVM-A013 | Instrument Calibration Batch 1 | **AMBIGUOUS** ELEC/INST | INSUFFICIENT | AMBIGUOUS |
| 26 | aeb2cd61 | WP-EVM-3 | EVM-A014 | DCS Point-to-Point Check | **AMBIGUOUS** ELEC/INST | INSUFFICIENT | AMBIGUOUS |
| 27 | f769fc26 | WP-EVM-4 | EVM-A015 | Scaffolding Erection - Area A | **AMBIGUOUS** WP-SUPP | INSUFFICIENT | AMBIGUOUS |
| 28 | fa1abd63 | WP-EVM-4 | EVM-A016 | Scaffolding Standby Crew | **AMBIGUOUS** WP-SUPP | INSUFFICIENT | AMBIGUOUS |
| 29 | 8d974797 | WP-EVM-4 | EVM-A017 | Mechanical Completion Milestone | **AMBIGUOUS** WP-SUPP | INSUFFICIENT | AMBIGUOUS |
| 30 | 2ad8df74 | WP-EVM-4 | EVM-A018 | Safety Walkdown | **AMBIGUOUS** WP-SUPP | INSUFFICIENT | AMBIGUOUS |
| 31 | 0ef0bd3d | WP-EVM-4 | EVM-A019 | Ready for Oil-In | **AMBIGUOUS** WP-SUPP | INSUFFICIENT | AMBIGUOUS |
| 32 | 64492a92 | WP-EVM-4 | EVM-A020 | Crane Availability (LOE) | **AMBIGUOUS** WP-SUPP | INSUFFICIENT | AMBIGUOUS |
| 33 | ccc8de63 | Test WP | — | Test Activity 1 | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 34–37 | (org 33318697) | WP-1 | CRIT-1 / NC-1 / NC-2 / SINK | CPM fixture | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 38–41 | (org 45a55491) | WP-1 | same | CPM fixture | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 42–45 | (org 4a79e17f) | WP-1 | same | CPM fixture | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 46–49 | (org 9e6db3f6) | WP-1 | same | CPM fixture | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 50–53 | (org fde58f6d) | WP-1 | same | CPM fixture | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |
| 54–69 | (org bfd38393 M10-R3) | WP-A/B/C/D | — | WP-A Act 1 … WP-D Act 3 | INSUFFICIENT (no org Discipline) | INSUFFICIENT | INSUFFICIENT_DATA |
| 70–72 | remaining test orgs | Test WP | — | Test Activity 1 / Weld Pipes / Install Piping | INSUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA |

Full UUIDs and per-field reasons: `var/r02-identity-backfill/discipline-sat-candidate-mapping.json`.

---

## What would have to exist before any future AUTO_SAFE write

1. Tenant Discipline rows for every org that should store `discipline_id` (11 of 12 live-activity orgs have none).
2. `Workpack.discipline_id` or `activity_library_id` + library.discipline, **or** an approved prefix map (`WP-MECH` → `MECH` only; never `WP-ELEC` while the title names two disciplines).
3. For SAT: `Workpack.equipment_type` or `Asset.equipment_type_id`, plus a SAT **code** (not an `ACT-*` library code, not `EVM-A*`).
4. Assets for HX-101 / V-201 / E-301 if those tags are meant to be equipment identity. They do not exist today.
5. A `PIPE` Discipline if WP-PIPE-001 is piping work. Do not reuse `MECH`.

Until those exist, leaving `discipline_id` and `standard_activity_type_id` null is correct. Filling them would be guessing.

**Rows modified in this pass: 0.**
