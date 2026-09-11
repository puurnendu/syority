# ACTIVITY CODE & STANDARD ACTIVITY ARCHITECTURE
**Syority Turnaround Management Platform**  
**Document Version:** 1.2.0  
**Status:** APPROVED ARCHITECTURE  
**Classification:** PLATFORM CLASSIFICATION & STANDARDIZATION ARCHITECTURE  

---

## 1. Objective & Governance Mandate

In industrial turnaround scheduling, activity classification requires both **rigorous standardization** (to enable identical-activity velocity analytics, EVM, and lookahead forecasting) and **intelligent planning acceleration** (to reduce planner fatigue and eliminate transcription errors).

### Fundamental Governance Principles
1. **Seed Intelligence is Suggestion & Default Intelligence Only**:
   The Activity Code and Standard Activity foundation accelerates planning by suggesting standard operational defaults based on Equipment Type. **It is never a mandatory restriction unless an explicit tenant business rule requires it.**
2. **The Triad of Value Governance**:
   - **SUGGESTED VALUE**: High-fidelity recommendation provided by the system.
   - **SELECTED VALUE**: The value explicitly confirmed or chosen by the planner.
   - **ENFORCED VALUE**: A value locked by an active, explicit, tenant-configured business rule.
   The system must **never silently convert a suggestion into an enforced restriction**.
3. **No Arbitrary Free Text for Classification**:
   Even when an option is absent from the seed, the planner must **never** type arbitrary free text into a classification field. The user must either select another valid controlled option or an authorized Admin creates the new controlled option first.
4. **Strict UDF Classification Rule**:
   `TEXT` UDFs are permitted **only for genuine narrative/custom textual information**. Any UDF intended for classification, grouping, filtering, reporting, analytics, or activity coding **MUST be `DROPDOWN` or `MULTI_SELECT` backed by controlled options**.
5. **Provenance Tracking**:
   Activities and templates track recommendation source where practical: `PLATFORM_DEFAULT` | `TENANT_DEFAULT` | `HISTORICAL_PATTERN` | `USER_SELECTED` | `AI_RECOMMENDATION`.

---

## 2. The Predictive Suggestion & Linkage Chain

```
                    ┌────────────────────────────┐
                    │       EquipmentType        │
                    │      HEX-ST, PMP-CF        │
                    └─────────────┬──────────────┘
                                  │
                                  │ Suggests / Recommends
                                  ▼
                    ┌────────────────────────────┐
                    │    StandardActivityType    │
                    │   HEX-ST -> BPULL, BLIND   │
                    │   PMP-CF -> ISOL, DISASM   │
                    └─────────────┬──────────────┘
                                  │
                                  │ Recommends / Auto-populates
                                  ▼
                    ┌────────────────────────────┐
                    │      ActivityLibrary       │
                    │  ACT-MECH-0011 (Bundle)    │
                    │  ACT-PMP-0004 (Seal Repl)  │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │     Operational Activity   │
                    │  activity_id: E-101A_003   │
                    │  description: "Pull Bundle"│
                    │  standard_activity_type_id │
                    │  activity_library_id       │
                    │  discipline_id: MECH       │
                    │  work_phase: MECHANICAL    │
                    └────────────────────────────┘
```

### Intelligence vs Flexibility Rules:
1. **Intelligent Predictive Defaults**:
   When a planner adds an activity to an equipment item:
   - Selecting Asset `E-101A` identifies its `EquipmentType` (`HEX-ST`).
   - The UI presents the recommended **Standard Activities** for `HEX-ST` (`BLIND`, `BOX_OPEN`, `BPULL`, etc.).
   - Selecting `BPULL` suggests the default **Discipline** (`MECH`), typical duration (16h), suggested **Work Phase** (`MECHANICAL`), and default resource requirements (Rigging Crew + Fitters).
2. **Planner Autonomy (Override Allowed)**:
   These values are **recommendations**, not mandatory locks (unless an explicit business rule enforces a specific constraint). The planner can freely choose another valid discipline, adjust the duration, or select a different standard activity from the master library.
3. **No Arbitrary Free Text**:
   If an activity requires a discipline or phase not present in the suggestions, the planner **must select another existing valid master option**. If a brand-new discipline or code is required, an authorized Admin must create it in Master Data / UDF settings first. Free-text entry into classification fields is blocked.
4. **Preserve Historical References**:
   Deleting or deactivating an Activity Code or Standard Activity does not delete past activities. Inactive codes remain intact on historical records via their immutable UUIDs (`activity_library_id`, `standard_activity_type_id`).

---

## 3. Standard Activity Matrix by Equipment Type (Seed Intelligence)

> [!IMPORTANT]
> **Recommendation Intelligence Only**: The activities below represent the platform's industrial standard recommendation package. They are **suggestions/defaults, not forced values**. Planners may accept, remove, or add valid controlled activities from the library. Values never become mandatory restrictions unless an explicit tenant business rule enforces them.

| Equipment Type Code | Equipment Type Name | Standard Activity Code | Standard Activity Name | Typical Duration | Recommendation Scope | Suggested Discipline | Suggested Phase | Suggested Readiness / Resources |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HEX-ST` | Shell & Tube Exchanger | `HANDOVER` | Operations to Maintenance Handover | 4.0 hrs | Default Recommendation | `OPS` / `MECH` | `PREPARATION` | LOTO, Gas Free Certificate |
| `HEX-ST` | Shell & Tube Exchanger | `BLIND` | Blinding & Isolation | 8.0 hrs | Default Recommendation | `MECH` | `PREPARATION` | Blind List, Scaffolding Tag |
| `HEX-ST` | Shell & Tube Exchanger | `BOX_OPEN` | Channel Head / Shell Cover Opening | 12.0 hrs | Default Recommendation | `MECH` | `MECHANICAL` | Crane Rigging Plan |
| `HEX-ST` | Shell & Tube Exchanger | `BPULL` | Tube Bundle Pullout & Transport | 16.0 hrs | Default Recommendation | `MECH` | `MECHANICAL` | Bundle Extractor, 50T Crane |
| `HEX-ST` | Shell & Tube Exchanger | `CLEAN` | High Pressure Water Jet Cleaning | 16.0 hrs | Default Recommendation | `CLN` | `MECHANICAL` | Wash Pad Clearance, PPE |
| `HEX-ST` | Shell & Tube Exchanger | `INSP` | Shell, Tube & NDE Inspection | 24.0 hrs | Default Recommendation | `INSP` | `INSPECTION` | NDT Equipment, Calibration |
| `HEX-ST` | Shell & Tube Exchanger | `REPAIR` | Tube Plugging, Retubing or Gasket Machining | 40.0 hrs | Contingency Recommendation | `MECH` | `MECHANICAL` | Replacement Tubes / Plugs |
| `HEX-ST` | Shell & Tube Exchanger | `BINST` | Tube Bundle Insertion | 16.0 hrs | Default Recommendation | `MECH` | `BOX_UP` | Bundle Extractor, Crane |
| `HEX-ST` | Shell & Tube Exchanger | `BOX_CLOSE` | Channel Head Box-up & Bolt Torquing | 12.0 hrs | Default Recommendation | `MECH` | `BOX_UP` | Torque Calibrator, New Gaskets |
| `HEX-ST` | Shell & Tube Exchanger | `LEAK_TEST` | Hydrostatic Shell & Tube Leak Test | 8.0 hrs | Default Recommendation | `MECH` | `PRECOMM` | Test Manifold, Calibrated Gauge |
| `HEX-ST` | Shell & Tube Exchanger | `DEBLIND` | De-blinding & Process Restoration | 8.0 hrs | Default Recommendation | `MECH` | `PRECOMM` | Blind Sign-off Sheet |
| `PMP-CF` | Centrifugal Pump | `HANDOVER` | Operations Electrical & Process Handover | 2.0 hrs | Default Recommendation | `OPS` / `MECH` | `PREPARATION` | LOTO Sign-off |
| `PMP-CF` | Centrifugal Pump | `ISOL` | Electrical LOTO & Process Isolation | 4.0 hrs | Default Recommendation | `ELEC` / `MECH`| `PREPARATION` | Lockout Box, Isolation Padlocks |
| `PMP-CF` | Centrifugal Pump | `ALIGN_CHK` | Pre-disassembly Alignment Check | 4.0 hrs | Default Recommendation | `MECH` | `PREPARATION` | Dial Indicators |
| `PMP-CF` | Centrifugal Pump | `DISASM` | Casing & Impeller Disassembly | 8.0 hrs | Default Recommendation | `MECH` | `MECHANICAL` | Crane / Gantry, Fitter Tools |
| `PMP-CF` | Centrifugal Pump | `INSP` | Wear Ring & Clearance Inspection | 12.0 hrs | Default Recommendation | `INSP` | `INSPECTION` | Micrometers, Bore Gauges |
| `PMP-CF` | Centrifugal Pump | `BRG_REPL` | Mechanical Seal & Bearing Replacement | 8.0 hrs | Contingency Recommendation | `MECH` | `MECHANICAL` | Seal Kit, Bearing Heater |
| `PMP-CF` | Centrifugal Pump | `ASSEM` | Reassembly & Casing Bolting | 8.0 hrs | Default Recommendation | `MECH` | `BOX_UP` | Torque Wrench, Casing Gasket |
| `PMP-CF` | Centrifugal Pump | `ALIGN` | Precision Laser Shaft Alignment | 6.0 hrs | Default Recommendation | `MECH` | `BOX_UP` | Laser Alignment Kit |
| `PMP-CF` | Centrifugal Pump | `RUN_TEST` | Solo Run & Coupled Performance Test | 4.0 hrs | Default Recommendation | `MECH` | `COMMISSIONING`| Vibration Monitor, Tachometer |

---

## 4. UDF Option Administration & Historical Integrity

1. **Option Lifecycle**:
   - `is_active = true`: Available for selection in UI and import mapping.
   - `is_active = false` / `deleted_at`: Deprecated/deactivated. Existing historical activities continue to display the option seamlessly. New forms and imports cannot select it.
2. **Safe Deletion Guard**:
   - `app/api/master-data/udf-definitions/[id]/options/route.ts` already enforces:
     ```ts
     const count = await prisma.activityUdfValue.count({ where: { udf_option_id: ex.id } });
     if (count > 0) {
       return NextResponse.json({
         error: 'OPTION_IN_USE',
         message: `Option in use by ${count} activities — deactivate instead`
       }, { status: 409 });
     }
     ```
   - Physical deletion is allowed only for options with 0 historical references. In-use options must be deactivated.
3. **Display Label Renaming**:
   - Because `ActivityUdfValue` references `udf_option_id` (UUID), an administrator can update the option label (e.g. from `"Phase 1"` to `"Execution — Stage 1"`) without breaking existing activity values or requiring expensive data migrations.
