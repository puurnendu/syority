# MASTER DATA & SEED FOUNDATION ARCHITECTURE
**Syority Turnaround Management Platform**  
**Document Version:** 1.2.0  
**Status:** APPROVED ARCHITECTURE  
**Classification:** PLATFORM GOVERNANCE & CORE DATA FOUNDATION  

---

## 1. Executive Summary & Governance Mandate

The objective of this architecture is to establish a **permanent, version-controlled, idempotent seed foundation** and an authoritative **controlled-value resolution layer** across all modules of the Syority platform.

$$\text{MASTER DATA} + \text{DEFAULT UDF} + \text{TENANT UDF} + \text{ACTIVITY CODE} + \text{STANDARD ACTIVITY} \longrightarrow \text{CONTROLLED VALUE RESOLVER} \longrightarrow \text{ALL CONSUMING MODULES}$$

### Non-Negotiable Governance Principles
1. **Seed Data is Recommendation / Default Intelligence Only**:
   Seed data provides high-fidelity industrial defaults to accelerate planning velocity and eliminate manual transcription errors. **It must never become a mandatory restriction unless an explicit tenant business rule marks a value mandatory.**
2. **The Triad of Value Governance**:
   For every field and recommendation across the application, the system preserves the distinction between:
   - **SUGGESTED VALUE**: Intelligent default derived from Master Data, Equipment Type, Standard Activities, or AI.
   - **SELECTED VALUE**: The value explicitly chosen or confirmed by the human planner from the controlled library.
   - **ENFORCED VALUE**: A value locked by an active, explicit, tenant-configured business rule (e.g. mandatory safety isolation).
   The system must **never silently convert a suggestion into an enforced restriction**.
3. **Provenance Tracking (Foundation for M16)**:
   Where practical, seed and activity records support provenance metadata to distinguish origins:
   `PLATFORM_DEFAULT` | `TENANT_DEFAULT` | `HISTORICAL_PATTERN` | `USER_SELECTED` | `AI_RECOMMENDATION`.
4. **Strict UDF Classification Rule**:
   `TEXT` UDFs are permitted **strictly for genuine narrative or free-form textual notes**. Any UDF intended for classification, grouping, filtering, reporting, analytics, or activity coding **MUST be `DROPDOWN` (`SELECT`) or `MULTI_SELECT` backed by controlled options**.
5. **Prohibition of Free-Text Classification**:
   When an option is not present in the seed or library, the user must **never** type arbitrary free text into a classification field. The user must either:
   - Select another existing valid controlled option, or
   - Create/request a new controlled option through the governed Master Data / UDF administration workflow.
6. **The Validation Plant is a Permanent Living Reference Complex**:
   The validation plant is **NOT disposable test data**. It is a permanent, living industrial reference complex preserved and regression-tested across all major releases. Future releases will expand and refine it as domain knowledge grows.
7. **Zero Historical Data Destruction**:
   Never physically delete an option with historical references. Inactive options use an **ACTIVE / INACTIVE lifecycle** (`is_active = false`, `deleted_at = timestamp`) to preserve historical integrity.

---

## 2. Seed Intelligence vs Planner Autonomy

### 2.1 The Equipment-to-Activity Suggestion Chain
When a planner associates work with an equipment item:
- **Step 1: Asset Selection**: Planner selects Asset `E-101A` (`HEX-ST` Shell & Tube Exchanger).
- **Step 2: Recommended Standard Activities**: The system suggests typical turnaround activities for `HEX-ST`:
  - `HANDOVER` (Operations to Maintenance Handover)
  - `BLIND` (Blinding & Isolation)
  - `BOX_OPEN` (Opening & Head Removal)
  - `BPULL` (Bundle Pullout)
  - `CLEAN` (HP Water Jet Cleaning)
  - `INSP` (Shell & Tube Inspection)
  - `REPAIR` (Tube Plugging / Retubing)
  - `BINST` (Bundle Insertion)
  - `BOX_CLOSE` (Box-up & Torquing)
  - `LEAK_TEST` (Hydrostatic Leak Test)
  - `DEBLIND` (De-blinding & Restoration)
- **Step 3: Planner Autonomy**: The planner may **accept**, **remove**, or **add** other valid controlled activities from the master library. Suggestions are not forced.
- **Step 4: Predictive Attribute Defaults**:
  Selecting `BPULL` (Bundle Pullout) provides suggestions:
  - Suggested Discipline: `MECH`
  - Suggested Work Phase: `MECHANICAL`
  - Suggested Activity Code: `ACT-MECH-0011`
  - Typical Duration: `16.0 hours`
  - Recommended Resources: `Rigging Crew x 1, Mechanical Fitter x 2, 50T Crane x 1`
  - Readiness Requirements: `LOTO Clearance, Crane Lift Plan`
  These are suggestions/defaults, not forced values. The planner may accept these or select another valid discipline, phase, code, duration, resources, or readiness requirements.

---

## 3. UDF Architecture & Administration

### 3.1 Strict UDF Type Governance
| UDF Data Type | Permitted Business Use | Prohibited Business Use |
| :--- | :--- | :--- |
| **DROPDOWN (`SELECT`)** | All single-value business classifications, phases, stages, shifts, hold types, categories | Free-form notes |
| **MULTI_SELECT** | Multi-axial tagging, multiple permits required, secondary crafts | Free-form notes |
| **TEXT** | Genuine free-form narrative, special execution notes, specific location remarks | **Strictly prohibited** for classification, filtering, grouping, reporting, analytics |
| **NUMBER** | Measured physical tolerances, pressures, temperatures, custom hours | Classification categories |
| **DATE** | Regulatory inspection deadlines, specialized window targets | Classification categories |
| **BOOLEAN** | Binary flags (e.g. `is_night_shift_approved`, `requires_third_party_inspector`) | Multi-state categories |

### 3.2 Tenant UDF Full Autonomy
Tenant Administrators have full administrative authority over tenant-scoped UDFs:
- **Create**: Add new UDFs across any supported type.
- **Edit Metadata**: Modify labels, descriptions, column widths, validation rules.
- **Manage Options**: Add options, rename labels, reorder display sequence, toggle active/inactive.
- **Configure Behavior**: Set `is_filterable`, `is_sortable`, `is_groupable`, `is_bulk_editable`, and `display_order`.
- **Safe Deletion**: Unused tenant UDFs with 0 activity values can be deleted safely.

### 3.3 Protected Platform UDFs (System-Level Stability)
- System UDFs required by core platform engines (e.g. `UDF_WORK_PHASE`, `UDF_SHUTDOWN_PHASE`) are marked `is_system: true`.
- Core engines rely on these codes for S-Curve calculation, EVM milestone reporting, and M14 dashboard analytics.
- Tenant administrators can configure permitted options, adjust display order, and deactivate unneeded options, but **cannot delete the definition or remove required core system codes**.

### 3.4 Historical Reference Protection
- `app/api/master-data/udf-definitions/[id]/options/route.ts` enforces that if an option is referenced in `ActivityUdfValue`, physical deletion is rejected:
  ```json
  { "error": "OPTION_IN_USE", "message": "Option in use by 14 activities — deactivate instead" }
  ```
- Deactivated options (`is_active: false`, `deleted_at: timestamp`) remain intact on historical records and reports, but are excluded from new dropdown selections.

---

## 4. Version-Controlled Seed Architecture

The seed framework is organized into two version-controlled, idempotent tiers:

### 4.1 Platform Standard Seed (`prisma/seeds/platform-seed.ts`)
- **Target**: `syority-platform` (or `organization_id: null` for platform-wide library records).
- **Contents**:
  - **10 Global Disciplines**: `MECH`, `ELEC`, `INST`, `CIVL`, `INSP`, `SCAF`, `PNT`, `INSUL`, `CLN`, `QAQC`.
  - **50+ Refinery Equipment Types**: `HEX-ST`, `HEX-AC`, `PMP-CF`, `PMP-PD`, `VSL-PV`, `VSL-DR`, `COL-DS`, `COL-AB`, `RCT-FX`, `CMP-CC`, `CMP-RC`, `HTR-FH`, `BLR-WH`, `VLV-CV`, `VLV-PSV`, etc.
  - **60+ Standard Activity Types**: Fully mapped to Equipment Types with typical durations and suggested phases.
  - **250+ Governed Activity Codes**: (`ActivityLibrary`) with typical durations, disciplines, and linked `activity_code_default_resources`.
  - **Protected System UDFs**: `UDF_WORK_PHASE`, `UDF_SHUTDOWN_PHASE`, `UDF_HOLD_TYPE`, `UDF_SAFETY_CATEGORY` with controlled options.
- **Idempotency Guarantee**: All seed scripts use deterministic code lookups (`findFirst` by `code` / `slug`). Re-running updates non-destructive attributes and inserts missing records without affecting tenant customizations.

### 4.2 Permanent Living Validation Plant (`prisma/seeds/validation-plant-seed.ts`)
- **Target**: Reference tenant `auriana-refining`, Site `EUR-S1`.
- **Complex**: **Apex Euro Refining & Petrochemicals Complex**:
  - Plant: `CDU-PLANT` (Crude & Vacuum Distillation Plant)
  - Areas: `CDU-AREA`, `VDU-AREA`
  - Units: `CDU-1`, `VDU-1`, `FCCU-1`
  - Systems: `CDU-PHT` (Crude Preheat Train), `CDU-ATM` (Atmospheric Column), `CDU-DES` (Desalter Package), `VDU-COL` (Vacuum Column)
  - Equipment / Assets: `E-101A`, `E-101B` (`HEX-ST`), `P-101A`, `P-101B` (`PMP-CF`), `C-101`, `C-201` (`COL-DS`), `V-102` (`VSL-PV`), `H-201` (`HTR-FH`).
  - All assets have valid `plant_id`, `unit_id`, `system_id`, `equipment_type_id`, `status: active`, `criticality: high/medium`.
  - Contractors: `APEX-MECH`, `GLOBE-ELEC`, `SAFE-SCAF`, `INSPECT-NDT`.
  - Turnaround Event: `TA-2028-M01` ("Spring 2028 Major Turnaround") with realistic workpacks and fully classified activities.
- **Living Reference Mandate**: Preserved and regression-tested across all major releases. Future releases expand its scope rather than destroying it.
