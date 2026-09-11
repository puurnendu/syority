# CROSS-MODULE CONTROLLED FIELD & UDF FORENSIC AUDIT
**Syority Turnaround Management Platform**  
**Document Version:** 1.2.0  
**Audit Date:** 2026-09-07  
**Status:** APPROVED ARCHITECTURE  
**Scope:** Repository-wide audit of all modules, schemas, UI components, APIs, UDF settings, and import pipelines  

---

## 1. Executive Summary & Governance Mandate

### Core Governance Rule
Controlled business fields must **never rely on arbitrary free-text entry**. They must strictly use:
1. Existing master-data selection
2. Dropdown / select list
3. Cascading hierarchical dropdown
4. Multi-select from controlled options
5. Radio / button selection
6. Controlled UDF option selection
7. Controlled import mapping & validation

### Critical Clarifications Formally Incorporated
- **Seed Data is Recommendation Intelligence Only**:
  Seed intelligence suggests defaults (e.g. Equipment Type $\to$ Standard Activities $\to$ Activity Code $\to$ Discipline $\to$ Work Phase $\to$ resources). **It is never a mandatory restriction unless an explicit tenant business rule enforces it.**
- **The Triad of Value Governance**:
  The system strictly distinguishes between **SUGGESTED VALUE**, **SELECTED VALUE**, and **ENFORCED VALUE**. Suggestions are never silently converted into enforced restrictions.
- **Strict UDF Rule**:
  `TEXT` UDFs are permitted strictly for genuine narrative or free-form notes. Any UDF used for classification, grouping, filtering, reporting, analytics, or activity coding **MUST be `DROPDOWN` or `MULTI_SELECT` backed by controlled options**.
- **No Free-Text Classification**:
  When a desired value is missing from the seed, the user must **never** type free text into a classification field. Either select another existing valid controlled option or create/request a new controlled option through the governed master/UDF administration workflow.
- **The Validation Plant is a Permanent Living Reference Complex**:
  Not disposable test data. Every major release preserves and regression-tests against it.
- **Zero Historical Data Destruction**:
  Never physically delete an option with historical references. Inactive options use an **ACTIVE / INACTIVE lifecycle** (`is_active = false`, `deleted_at = timestamp`).

---

## 2. Comprehensive Cross-Module Forensic Inventory

| Dimension / Field | Module(s) | Current Input Type | Required Input Type | Category | Authority / Master | Free Text Allowed? | API Protected? | Duplicate / Governance Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Discipline** | Reports (`ReportCenter.tsx`) | `<input type="text">` | Controlled `<select>` | A | `Discipline` Master (`/api/disciplines`) | **NO** | Partial (API allows text query) | **High** (Filter mismatches: "Mechnical" vs "Mechanical") |
| **Discipline** | Workpack Creation | Controlled `<select>` | Controlled `<select>` | A | `Discipline` Master | **NO** | Yes (`discipline_id` FK) | Low |
| **Discipline** | Activity Creation | Controlled `<select>` | Controlled `<select>` | A | `Discipline` Master | **NO** | Yes (`discipline_id` FK) | Low |
| **Discipline** | Scope Creation | Controlled `<select>` | Controlled `<select>` | A | `Discipline` Master | **NO** | Partial (stored as string `discipline`) | Medium (Legacy string column) |
| **Discipline** | Schedule Scope Change | Free text in form | Controlled `<select>` | A | `Discipline` Master | **NO** | No (stores string) | Medium |
| **Equipment Type** | Workpack Creation (`WorkpackCreateForm.tsx`) | Select + free text (`__other`) | Controlled `<select>` ONLY | A | `EquipmentType` Master (`/api/equipment-types`) | **NO** | No (permits custom string) | **Critical** (Breaks Standard Activity templates) |
| **Equipment Type** | Asset Register | Controlled `<select>` | Controlled `<select>` | A | `EquipmentType` Master | **NO** | Yes (`equipment_type_id`) | Low |
| **Equipment Type** | Workpack Template | Controlled `<select>` | Controlled `<select>` | A | `EquipmentType` Master | **NO** | Partial | High |
| **Equipment Type** | Excel Plant Import (`PlantImportService.ts`) | String mapped to hardcoded Set | Validated against `EquipmentType` | A | `EquipmentType` Master | **NO** | No (in-memory Set) | High (New types created without master) |
| **Equipment (Asset)** | Workpack Creation (`WorkpackCreateForm.tsx`) | Select by tag | Cascading Master Selection | A | `Asset` Master (Digital Plant) | **NO** | Yes (`asset_id`) | **Critical** (If tag untied from plant hierarchy) |
| **Equipment (Asset)** | Scope Creation | Search & select asset | Master Selection | A | `Asset` Master | **NO** | Yes (`asset_id`) | Low |
| **Equipment (Asset)** | Activity Creation | Auto-inherited from Workpack | Auto-inherited Master | A | `Asset` Master | **NO** | Yes | Low |
| **Plant** | Asset / Workpack Creation | Cascading `<select>` | Cascading `<select>` | A | `Plant` Master | **NO** | Yes (`plant_id`) | Low |
| **Area** | Hierarchy / Workpack Creation | Cascading `<select>` | Cascading `<select>` | A | `Area` Master | **NO** | Yes (`area_id`) | Low |
| **Unit** | Workpack Creation (`WorkpackCreateForm.tsx`) | Free-text input (`unit_code`) | Auto-populated / Cascading `<select>` | A | `Unit` Master | **NO** | No (user types unit string) | **High** (Typo in unit code creates orphan references) |
| **System** | Hierarchy / Workpack Creation | Cascading `<select>` | Cascading `<select>` | A | `System` Master | **NO** | Yes (`system_id`) | Low |
| **Standard Activity** | Activity Creation | Free-text or dropdown | Controlled `<select>` (suggested by EquipmentType) | A | `StandardActivityType` Master | **NO** | No (`standard_activity_type_id` nullable) | **Critical** (Variant spellings destroy M8.13 identical metrics) |
| **Activity Code** | Activity Creation | Auto-generated or Library Select | Controlled Library Selection | C / F | `ActivityLibrary` (`activity_code`) | **NO** | Yes | Low |
| **Contractor** | Workpack Creation | Controlled `<select>` | Controlled `<select>` | A | `Contractor` Master | **NO** | Yes (`contractor_id`) | Low |
| **Contractor** | Activity Resource Assign | Controlled `<select>` | Controlled `<select>` | A | `Contractor` Master | **NO** | Yes (`contractor_id`) | Low |
| **Work Phase** | Activity UDF / Scheduling | Free-text string or UDF | Controlled Dropdown UDF | C | `ActivityUdfDefinition` (`UDF_WORK_PHASE`) | **NO** | No (String fallback in `ActivityUdfService`) | High (Breaks S-Curve and phase analysis) |
| **Shutdown Phase** | Activity UDF / Scheduling | Free-text string or UDF | Controlled Dropdown UDF | C | `ActivityUdfDefinition` (`UDF_SHUTDOWN_PHASE`)| **NO** | No | High |
| **Hold Point Type** | Workpack / Activity Creation | Select list | Controlled Enum / Option | B | `HoldPointType` (`Hold`, `Witness`, etc.) | **NO** | Yes | Low |
| **Priority** | Workpack Creation | Controlled `<select>` | Controlled Enum (`Priority`) | B | `Priority` Enum | **NO** | Partial (stored as String `Normal`) | Medium |
| **Criticality** | Asset Register | Controlled `<select>` | Controlled Enum (`AssetCriticality`)| B | `AssetCriticality` Enum | **NO** | Yes | Low |
| **Status** | Workpack / Activity / Scope | Workflow state machine | Governed State Machine | B | `WorkpackStatus`, `ActivityStatus` | **NO** | Yes | Low |
| **WBS Code** | Scheduling / Activity Creation | Text input | Governed WBS Node Selection | F | `WbsNode` Master | **NO** | Partial | Medium |
| **Work Category** | Activity Creation | Free-text string | Controlled Dropdown UDF / Option | C | `ActivityUdfOption` (`work_category`) | **NO** | No | High |
| **Constraint Type** | Execution / Planning | Controlled `<select>` | Controlled Enum (`ConstraintType`)| B | `ConstraintType` Enum | **NO** | Yes | Low |
| **Constraint Status** | Execution / Planning | Controlled `<select>` | Controlled Enum (`ConstraintStatus`)| B | `ConstraintStatus` Enum | **NO** | Yes | Low |
| **Material Readiness** | Material Supply / Tracking | Controlled badge | Controlled Enum | B | `MaterialReadiness` Enum | **NO** | Yes | Low |
| **Activity Description** | Activity Form | Text / Textarea | Text / Textarea | D | Narrative | **YES** | N/A | None |
| **Workpack Scope Narrative**| Workpack Form | Rich text / Textarea | Rich text / Textarea | D | Narrative | **YES** | N/A | None |
| **Execution Notes / Remarks**| Execution Logging | Textarea | Textarea | D | Narrative | **YES** | N/A | None |
| **Observation / Justification**| Scope Deferral / Discovery | Textarea | Textarea | D | Narrative | **YES** | N/A | None |

---

## 3. Demonstration Criteria (Post-Implementation Acceptance)

The implementation will demonstrate all eight non-negotiable proof points:
1. **Seed suggests values**: Equipment Type suggests standard activities and attribute defaults.
2. **User can choose another valid controlled value**: Planners can override suggestions by picking any other valid master option.
3. **User cannot type an arbitrary classification**: Free-text entry into classification fields is blocked across UI and API.
4. **Admin can create a new tenant UDF**: Full CRUD capabilities for tenant administrators.
5. **Admin can add UDF options**: Options can be created, reordered, and renamed.
6. **Historical options cannot be destroyed**: In-use options cannot be hard-deleted; they transition to inactive.
7. **Seed upgrades do not overwrite tenant customizations**: Platform seed execution is strictly idempotent and additive.
8. **Consistent controlled values across all modules**: Same controlled values operate seamlessly across Scope, Workpack, Activity, Execution, Reports, Dashboard, and Import.
