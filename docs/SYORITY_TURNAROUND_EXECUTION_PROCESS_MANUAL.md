# SYORITY TURNAROUND & SHUTDOWN EXECUTION MANUAL
## Standard Operating Procedure (SOP): P&ID Drawing Ingestion to 3-Year Closeout Management

**Document ID:** SOP-SYO-TAR-001  
**Version:** 2.0 (Enterprise Edition)  
**Applicability:** Refinery, Petrochemical, Chemical & Heavy Process Plants  
**System Platform:** SYORITY Shutdown / Turnaround Management System  

---

## EXECUTIVE SUMMARY & SYSTEM OPERATING PHILOSOPHY

The **SYORITY Turnaround & Shutdown Management System** is a purpose-built enterprise platform designed to execute complex industrial plant turnarounds (STOs) with mathematical predictability, zero-leak startup assurance, and uncompromising audit integrity.

### Operating Philosophy: Human-Driven Precision with Targeted AI Extraction
In SYORITY, **Artificial Intelligence plays a strictly bounded, non-destructive, and high-accuracy role**:
* **AI’s Exclusive Role:** High-speed computer vision and OCR ingestion of complex engineering drawings (P&IDs, Equipment GA Drawings, Nozzle Schedules, Isometrics, and Vendor Data Sheets) to extract raw structured data (tags, metallurgy, flange ratings, bolt sizes, gasket types, design specs, and nozzle elevations).
* **The Planner’s Essential Role:** The human planning engineer retains 100% engineering authority. The planner verifies extracted data, constructs the plant equipment hierarchy, instantiates canonical workpacks from standardized activity templates, assigns crew resources, defines hold points, manages critical path schedules, monitors field progress, generates statutory quality certificates, and manages multi-tiered executive dashboards.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE SYORITY TURNAROUND LIFECYCLE                                 │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┬──────────────────────────┤
│    PHASE 1      │    PHASE 2      │    PHASE 3      │    PHASE 4      │         PHASE 5          │
│ DRAWING & DATA  │ WORKPACK & QA   │ SCHEDULING, CPM │ EXECUTION & DPR │ CLOSEOUT & 3-YEAR CLIENT │
│   INGESTION     │  ENGINEERING    │   & P6 EXPORT   │ PROGRESS LOGS   │      ONLINE PORTAL       │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼──────────────────────────┤
│ • P&ID Upload   │ • Equipment WPs │ • Logic Links   │ • Shift Progress│ • Digital Dossier Export │
│ • AI OCR/Vision │ • 102 Canonical │ • CPM Forward / │ • UDF Actuals   │ • Box-Up Certificate Log │
│ • Planner Audit │   Activity Code │   Backward Pass │ • Hold Point QA │ • 3-Year Secure Cloud    │
│ • Asset Master  │ • Cert & Forms  │ • Resource Hist │ • 3-Tier DPR /  │ • Statutory Compliance & │
│   Creation      │ • Hold Points   │ • P6 / MSP Sync │   Dashboards    │   Next TAR Baseline Data │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴──────────────────────────┘
```

---

## 1. PHASE 1: ASSET HIERARCHY & DRAWING INGESTION (MINIMAL AI ROLE)

### 1.1 Master Asset Hierarchy Setup
Before drawing ingestion, the planning team establishes the multi-level plant hierarchy in SYORITY:
$$\text{Enterprise / Client} \longrightarrow \text{Site / Refinery} \longrightarrow \text{Complex / Plant} \longrightarrow \text{Unit (CDU, VDU, FCCU)} \longrightarrow \text{System / Sub-system} \longrightarrow \text{Equipment / Asset}$$

* **Planner Action:** Import or create unit masters (e.g., Unit 101 - Crude Distillation Unit, Unit 102 - Vacuum Distillation Unit).
* **Data Scoping:** Every asset is assigned equipment classification (Heat Exchanger, Column, Vessel, Furnace, Reactor, Pump, Piping Spool, Relief Valve, Tank).

### 1.2 Drawing Upload & Bounded AI Structured Extraction
The engineering team uploads PDF, TIFF, or DWG raster files (Equipment Mechanical Drawings, General Arrangement Drawings, Fabrication Drawings, and P&IDs).

```
   [Engineering Drawing (PDF/Scan)]
                 │
                 ▼
   ┌───────────────────────────┐
   │ AI Vision / OCR Extractor │  <--- ONLY AI TOUCHPOINT IN SYSTEM
   └─────────────┬─────────────┘
                 │
                 ▼ (Raw Extracted Data)
   ┌───────────────────────────────────────────────────────────┐
   │ • Equipment Tag & Service: E-101 (Crude Preheat Exchanger)│
   │ • Design Pressure / Temp: Shell 25 bar/250°C, Tube 40 bar │
   │ • Shell ID / Bundle Weight: 1200 mm / 18.5 MT             │
   │ • Nozzles: N1 (10" 300# RF), N2 (10" 300# RF), N3/N4 (8")│
   │ • Bolting: 1-1/4" Studs x 16 Nos, B7/2H Metallurgy        │
   │ • Gaskets: Spiral Wound SS316 with Graphite Filler        │
   └─────────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
   ┌───────────────────────────────────────────────────────────┐
   │ PLANNER AUDIT & APPROVAL GATE (100% Engineering Authority)│
   └─────────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
   [Verified Equipment Technical Master & Joint Integrity Table]
```

* **Step 1: AI Ingestion:** The SYORITY AI Vision engine scans drawing title blocks, nozzle schedules, bill of materials tables, and design data boxes.
* **Step 2: Candidate Generation:** The system parses extracted information into an `ExtractionCandidate` record.
* **Step 3: Planner Interactive Verification:** The planner reviews extracted values side-by-side with drawing highlights. The planner confirms, edits, or supplements:
  * Nozzle list and flange dimensions.
  * Gasket types (Spiral Wound, Kammprofile, Ring Joint, Compressed Synthetic Fiber).
  * Stud bolt diameters, lengths, metallurgy, and recommended torque values.
  * Bundle pulling weights, rigging requirements, and crane radii.
* **Step 4: Master Commitment:** Upon planner approval, SYORITY automatically populates:
  * Equipment Technical Record (`equipment_technical_data`).
  * Joint Integrity Master Register (`joint_masters`).
  * Blind Register (`system_blinds`).

---

## 2. PHASE 2: WORKPACK ENGINEERING & QUALITY PROTOCOL ASSEMBLY

Workpack generation in SYORITY follows deterministic engineering templates rather than generative guessing.

### 2.1 The Canonical Knowledge Bank (102 Activities, 14 Families)
Every maintenance operation is mapped to standardized domain activity codes:

| Activity Family | Family Code | Sample Canonical Activity Codes | Standard Discipline | Default Work Category |
|---|---|---|---|---|
| **Preparation** | `PREP` | `PREP.SCAFFOLDING`, `PREP.INSUL_REMOVE`, `PREP.LIGHTING` | Scaffolding / Insulation | Pre-Shutdown |
| **Isolation** | `ISO` | `ISO.BLIND_INSTALL`, `ISO.VENT_DRAIN`, `ISO.LOCK_OUT` | Mechanical / Operations | Shutdown Window |
| **Dismantling** | `DISMANTLE` | `DISM.CHANNEL_COVER`, `DISM.SHELL_COVER`, `DISM.TUBE_BUNDLE` | Rigging / Mechanical | Execution Window |
| **Cleaning** | `CLEAN` | `CLEAN.HP_WATER_JET`, `CLEAN.CHEMICAL`, `CLEAN.HYDRO_BLAST` | Specialized Service | Execution Window |
| **Inspection** | `INSP` | `INSP.VISUAL_INTERNAL`, `INSP.TUBE_INTERNAL`, `INSP.SHELL_THK` | Inspection / NDT | Quality Gate |
| **Non-Destructive Testing** | `NDT` | `NDT.ECT`, `NDT.IRIS`, `NDT.MPI`, `NDT.UT_GAUGING`, `NDT.PAUT` | Inspection Agency | Quality Gate |
| **Repair & Maintenance** | `REPAIR` | `REPAIR.TUBE_PLUGGING`, `REPAIR.WELD_OVERLAY`, `REPAIR.FACING` | Specialized Machining | Execution Window |
| **Surface Treatment** | `SURFACE` | `SURFACE.BLASTING`, `SURFACE.PRIMER_COAT`, `SURFACE.TOP_COAT` | Painting / Coating | Post-Execution |
| **Assembly & Box-Up** | `ASSY` | `ASSY.BUNDLE_INSERT`, `ASSY.SHELL_COVER`, `ASSY.TORQUING` | Mechanical / Bolting | Post-Execution |
| **Testing** | `TEST` | `TEST.SHELL_HYDRO`, `TEST.TUBE_HYDRO`, `TEST.PNEUMATIC` | Operations / Inspection | Quality Gate |
| **Quality Control** | `QC` | `QC.FINAL_BOXUP_SIGN`, `QC.PUNCH_CLEARANCE` | QA/QC Authority | Sign-off Gate |
| **Hold Points** | `HP` | `HP.STATUTORY_INSP`, `HP.BOXUP_CLEARANCE` | Client Inspector | Statutory Hold |
| **Logistics & Crane** | `LOGISTICS` | `LOG.CRANE_SETUP`, `LOG.BUNDLE_TRANSPORT` | Heavy Rigging | Services |
| **Administration** | `ADMIN` | `ADM.PERMIT_OBTAIN`, `ADM.TOOLBOX_TALK` | Safety / Execution | Overhead |

### 2.2 Template Instantiation Engine
The planner selects the equipment workpack and applies the corresponding canonical template (e.g., `HX-BUNDLE-INSP`, `COL-TRAY-INSP`, `VESSEL-INTERNAL-OVERHAUL`, `VALVE-PSV-TEST`).

```
   [Planner Selects Template: HX-BUNDLE-INSP]
                      │
                      ▼
   ┌────────────────────────────────────────────────────────┐
   │ INSTANTIATION ENGINE AUTOMATION                        │
   ├────────────────────────────────────────────────────────┤
   │ 1. 47 Standard Operations populated with dependencies   │
   │ 2. Standard Predecessor/Successor Logic Links mapped    │
   │ 3. Standard Crew Sizes & Craft Allocations assigned    │
   │ 4. 13 QA/QC Hold Points automatically designated       │
   │ 5. Quantity UDFs (Inch-Dia, SqM, Joints) generated     │
   └──────────────────────────┬─────────────────────────────┘
                              │
                              ▼
   [Planner Fine-Tunes Durations, Resources, & Material Lines]
```

### 2.3 Creating Inspection Forms, Checklists, & Statutory Certificates
The planner attaches mandatory statutory certificates and clearance forms to the Workpack:
1. **Flange Box-Up & Bolt Torquing Clearance Certificate:**
   * Contains exact joint ID, flange size, rating, gasket batch number, bolt lubricant, specified tightening method (Manual Torque, Hydraulic Tensioning, Torque Wrench), and final torque value ($N\cdot m$).
   * Formatted with 3-stage signature sign-offs: Contractor Supervisor $\rightarrow$ Plant QC $\rightarrow$ Client Inspector.
2. **Hydrostatic / Pneumatic Pressure Test Certificate:**
   * Documents test medium (Demineralized water, Air, Nitrogen), test pressure ($kg/cm^2$ or $bar$), hold duration (minimum 30 minutes), calibrated gauge serial numbers, and test witness signatures.
3. **Vessel Box-Up Clearance Certificate:**
   * Checklist verifying cleanliness, foreign material exclusion (FME), internal tray clamp tightness, sacrificial anode installation, and internal clearance sign-off.
4. **Blind Installation / Removal Tracker:**
   * Tabular register logging Blind Tag Number, Location, Blind Rating/Thickness, Installed By/Date, Removed By/Date, and Independent Cross-Check initials.

---

## 3. PHASE 3: SCHEDULING, CPM ANALYSIS & ENTERPRISE EXPORTS

### 3.1 Critical Path Method (CPM) Scheduling Engine
SYORITY features a native forward/backward pass CPM scheduling engine operating on 1-hour time increments:
* **Forward Pass (Early Dates):**
  $$ES_j = \max_{(i, j) \in Pred} (EF_i + \text{Lag}_{ij}), \quad EF_j = ES_j + \text{Duration}_j$$
* **Backward Pass (Late Dates):**
  $$LF_i = \min_{(i, j) \in Succ} (LS_j - \text{Lag}_{ij}), \quad LS_i = LF_i - \text{Duration}_i$$
* **Float Calculations:**
  $$\text{Total Float} (TF_i) = LS_i - ES_i = LF_i - EF_i$$
  $$\text{Free Float} (FF_i) = \min_{(i, j) \in Succ} (ES_j - \text{Lag}_{ij}) - EF_i$$
* **Critical Path Identification:** Activities with $TF = 0$ are designated as critical schedule drivers (`is_critical = true`), highlighted in red across all planning views.

### 3.2 Enterprise Bidirectional Exports (Primavera P6 & MS Project)
To seamlessly integrate with client enterprise project management systems, SYORITY generates standards-compliant export files:

```
                      ┌──────────────────────────────────────┐
                      │    SYORITY CENTRAL SCHEDULE CORE     │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
      ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
      │  PRIMAVERA P6 XER  │  │  PRIMAVERA P6 XML  │  │   MS PROJECT XML   │
      ├────────────────────┤  ├────────────────────┤  ├────────────────────┤
      │ • Full WBS Hierarchy│  │ • Schema Validated │  │ • FieldID Extended │
      │ • TASK & TASKPRED  │  │ • API Business Obj  │  │   Attribute Mappings│
      │ • UDFTYPE 9 mapped │  │ • <UDF name=        │  │ • Task Hierarchy   │
      │   (SY_ACTIVITY_CODE)│ │   "SY_ACTIVITY_CODE"│ │ • Custom Attributes │
      │ • Predecessors/Lags│  │ • Exact Logic Links │  │ • Logic links (FS) │
      └────────────────────┘  └────────────────────┘  └────────────────────┘
```

---

## 4. PHASE 4: EXECUTION TRACKING, DPR & MULTI-TIERED DASHBOARDS

During the active turnaround execution window, SYORITY operates in real-time mode to capture shift progress and eliminate end-of-shift reporting delays.

### 4.1 Field Progress Logging & Quantity Tracking
Execution engineers and supervisors record progress via web tablets or digital logging stations:
* **Progress Logging:** Step physical completion (0% to 100%), actual start timestamp, and actual finish timestamp.
* **Quantity UDF Updates:** Entry of completed physical units:
  * Welding: Inch-Dia completed today vs. balance.
  * Piping: Joints blinded / de-blinded.
  * Structural: Volume ($m^3$) of scaffolding erected / dismantled.
  * Painting & Insulation: Surface area ($m^2$) prepped / coated.
* **Hold-Point Witness Verification:** QA/QC inspectors electronically sign off hold points. A downstream activity cannot start if its preceding hold point remains open.

### 4.2 Three-Tiered Management Dashboard & DPR Architecture
SYORITY separates operational noise from executive visibility by delivering role-configured dashboard layers:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             TIER 1: TOP MANAGEMENT & EXECUTIVE DASHBOARD                         │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ FOCUS: High-level KPIs, S-Curves, Earned Value Management, Macro Completion                      │
│                                                                                                  │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│   │ OVERALL PROGRESS │  │  SCHEDULE INDEX  │  │    COST INDEX    │  │  HOLD POINT GATES│        │
│   │      68.4%       │  │    SPI = 0.98    │  │    CPI = 1.02    │  │  142/150 Cleared │        │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘        │
│                                                                                                  │
│  • Lightweight Management Metric:                                                                │
│    - Planned Workpacks (to cutoff): 30                                                           │
│    - Completed Workpacks: 25                                                                     │
│    - Balance Workpacks: 5                                                                        │
│    - Achievement: 83.33%                                                                         │
│  • Executive Physical S-Curve (Planned vs. Actual vs. Forecast)                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           TIER 2: MIDDLE MANAGEMENT & UNIT IN-CHARGE VIEW                        │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ FOCUS: Unit-wise Status Table, Equipment Group Metrics, Joint Box-Up Progress                    │
│                                                                                                  │
│  EQUIPMENT STATUS TABLE (DPR Core):                                                              │
│  ┌──────┬────────────────┬───────────────┬─────────────────┬───────────────┬──────────────────┐  │
│  │ Unit │ Equipment Type │ Planned Items │ Completed Items │ Balance Items │ Status           │  │
│  ├──────┼────────────────┼───────────────┼─────────────────┼───────────────┼──────────────────┤  │
│  │ CDU  │ Heat Exchanger │      50       │       42        │       8       │ In Progress      │  │
│  │ CDU  │ Vessel / Drum  │      20       │       20        │       0       │ Complete         │  │
│  │ CDU  │ Column         │       6       │        4        │       2       │ In Progress      │  │
│  │ VDU  │ Heat Exchanger │      30       │       25        │       5       │ In Progress      │  │
│  │ VDU  │ Furnace (Tubes)│       2       │        1        │       1       │ In Progress      │  │
│  └──────┴────────────────┴───────────────┴─────────────────┴───────────────┴──────────────────┘  │
│                                                                                                  │
│  • Flange Box-Up Clearance Tracker (Total Joints vs. Torqued vs. QA Certified)                   │
│  • Critical Path Delay Radar (Alerting on activities eating total float)                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         TIER 3: PLANNING & FIELD EXECUTION DETAILED VIEW                         │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ FOCUS: Micro-activities, 24/48-Hour Lookahead, Resource Histograms, Constraints                  │
│                                                                                                  │
│  • Gantt Chart with Live Critical Path Highlighting                                              │
│  • 24-Hour & 48-Hour Shift Lookahead Schedules by Discipline & Contractor                        │
│  • Trade Manpower Deployment Histograms (Welders, Riggers, Fitters, Scaffolders)                 │
│  • Active Constraint Register (Permit blocks, Crane clashes, Material shortages)                 │
│  • Punch List Clearance Tracking (Category A: Pre-startup, B: Pre-commissioning, C: Post)        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. PHASE 5: CLOSEOUT, AS-BUILT DOSSIER & 3-YEAR CLIENT ONLINE ACCESS

### 5.1 Automated Digital Workpack Dossier Compilation
Upon mechanical completion and punch list sign-off, SYORITY aggregates all field artifacts into a certified, tamper-evident PDF dossier:
* **Section A:** Cover Sheet & Turnaround Executive Summary
* **Section B:** Master Equipment Index & Specification Sheets
* **Section C:** As-Built Operations & Activity Execution Log
* **Section D:** Verified Joint Integrity & Flange Box-Up Certificates (with torque values and technician IDs)
* **Section E:** Pressure Test (Hydro/Pneumatic) Certificates & Calibrated Chart Records
* **Section F:** NDT Inspection Reports, Ultrasonic Thickness Surveys & Eddy Current Logs
* **Section G:** Cleaning & Blasting Verification Records
* **Section H:** MOC (Management of Change) & As-Found / As-Left Photographic Logs
* **Section I:** Final Quality Clearance & Handover Sign-off

### 5.2 3-Year Secure Customer Cloud Portal
A dedicated, role-protected tenant instance is provided to the plant asset owner for **3 full years post-turnaround**:

```
                              ┌───────────────────────────────────┐
                              │  3-YEAR CUSTOMER SECURE PORTAL    │
                              └─────────────────┬─────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      ┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
      │ INSTANT ASSET TAG  │         │ STATUTORY AUDIT &  │         │ NEXT SHUTDOWN (TAR)│
      │     DISCOVERY      │         │   RBI COMPLIANCE   │         │    BASELINE DATA   │
      ├────────────────────┤         ├────────────────────┤         ├────────────────────┤
      │ Search any Tag     │         │ On-demand access   │         │ 100% reusable      │
      │ (e.g. 101-E-101)   │         │ for insurance, OISD│         │ baseline durations,│
      │ to retrieve torque │         │ statutory bodies,  │         │ actual manpower    │
      │ values, gasket     │         │ and environmental  │         │ consumption, and   │
      │ heat numbers, and  │         │ inspectors with full│        │ historical scope   │
      │ inspection photos  │         │ cryptographic audit│         │ templates for next │
      │ in under 3 seconds.│         │ trail.             │         │ turnaround cycle.  │
      └────────────────────┘         └────────────────────┘         └────────────────────┘
```

---

## 6. QUANTIFIED VALUE PROPOSITION & BUSINESS BENEFITS

Implementing SYORITY across the turnaround lifecycle delivers measurable operational and commercial returns:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             BENEFIT COMPARISON: TRADITIONAL VS. SYORITY                          │
├──────────────────────────────┬───────────────────────────────┬───────────────────────────────────┤
│ METRIC / WORKFLOW            │ TRADITIONAL MANUAL / EXCEL    │ SYORITY TURNAROUND SUITE          │
├──────────────────────────────┼───────────────────────────────┼───────────────────────────────────┤
│ Workpack Assembly Time       │ 8 - 14 Days per Workpack      │ 4 - 6 Hours per Workpack (-70%)   │
│ Drawing Data Extraction      │ 4 Hours manual typing/tagging │ 2 Minutes AI Vision Scan + Review │
│ Quality Hold-Point Bypasses  │ 5% - 8% missed in field       │ 0% (System enforces logic lock)   │
│ Post-Turnaround Flange Leaks │ 2 - 5 Leaks per startup       │ ZERO Leaks (Torque Cert locked)   │
│ Schedule Float Visibility    │ Stale (Updated once daily)    │ Real-time CPM Dynamic Float       │
│ DPR Compilation Effort       │ 3 - 4 Hours every evening     │ 1-Click Instant Automated DPR     │
│ Closeout Dossier Handover    │ 3 - 6 Months post-turnaround  │ 48 Hours post-mechanical complete │
│ Historical Data Retrieval    │ Lost in physical binders      │ 3 Years Instant Online Search     │
└──────────────────────────────┴───────────────────────────────┴───────────────────────────────────┘
```

### Summary of Strategic Advantages:
1. **Schedule Compression:** Eliminates up to 15% of critical path execution delays through dynamic predecessor tracking and real-time constraint elimination.
2. **Zero-Leak Guarantee:** Controlled bolting, specified torque values, and mandatory multi-party sign-offs on the Flange Box-Up Certificate eliminate startup re-tightening and hydrocarbon leaks.
3. **Audit Readiness:** Every modification, permit clearance, torque record, and NDT thickness reading is time-stamped, user-tagged, and digitally archived for 3 years.
4. **Institutional Memory:** The canonical template repository ensures that plant-specific maintenance knowledge is permanently captured in the system rather than leaving with retiring personnel or third-party contractors.

---

## 7. DOCUMENT CONTROL & SIGN-OFF

**Prepared By:** Product Architecture & Turnaround Domain Engineering Team  
**Reviewed By:** Chief Turnaround Planning Specialist & Primavera P6 Subject Matter Expert  
**Approved For Implementation:** SYORITY Enterprise Operations Board  
**Target Deployment:** Turnaround Planning, Scheduling, Quality & Field Execution Teams  
