# ADR-0012: Workpack Template Architecture

**Date:** 2026-07-29
**Status:** ACCEPTED
**Deciders:** Product Architecture Team, Lead Planner

---

## Context

Aurianoa OS provides Shutdown Turnaround & Outage (STO) planning software for refineries, petrochemical plants, and industrial facilities. The M7 milestone series introduced:

- **M7.1** Digital Plant Builder — engineering asset register
- **M7.2** Engineering Scope Intelligence — issue intake and AI organization
- **M7.3** Shutdown Scope Manager — official deliverable before planning
- **M7.4** Workpack Intelligence Engine — transforms approved scope items into executable workpacks
- **M7.5** Planner Workspace — P6-inspired multi-pane planning surface

During M7.4 implementation, a `MaintenanceStrategy` model was introduced as an intermediate reusable object between the scope item and the workpack template. This created ambiguity about the canonical planning object and risked duplicating template logic.

This ADR resolves that ambiguity permanently.

---

## Decision

**Workpack Templates are the ONLY reusable execution object in Aurianoa OS.**

The frozen planning architecture is:

```
Digital Plant (Asset Register)
        ↓
Engineering Issues (Multi-Department Intake)
        ↓
Shutdown Scope (Planner-Approved Deliverable)
        ↓
Planner Selects Workpack Template
        ↓
Instantiate Workpack (via Workpack Intelligence Engine)
        ↓
Activities (Template-Generated)
        ↓
Execution
```

### What Workpack Templates Own

A Workpack Template is the single source of truth for reusable execution knowledge:

- Activities (sequence, duration, logic)
- Logic Links (predecessor/successor relationships)
- Resources (labor, equipment, crew)
- Materials (BOMs, specifications)
- Tools (standard and specialty)
- Certifications (QA/QC requirements)
- Isolation Requirements
- Required Documents
- Standard Duration
- Required UDFs
- Quality Forms
- Safety Forms

### What Workpack Templates Do NOT Own

- Asset identity (comes from Digital Plant)
- Scope justification (comes from Engineering Issues → Shutdown Scope)
- Planning decisions (made by the Planner)
- Execution status (tracked on the instantiated Workpack)

---

## Consequences

### 1. MaintenanceStrategy Is Removed

The `MaintenanceStrategy` model, its service, and its API routes are removed from the M7 codebase. The concept of a "maintenance strategy" is deferred to the future Asset Integrity milestone, where it will function as a recommendation engine that outputs a suggested Workpack Template — never as an independent reusable execution object.

### 2. Work Type Master Is Introduced

A new `WorkType` model replaces free-text `work_type` and `job_type` fields with a structured, two-level taxonomy:

```
Category (e.g., Mechanical, Rotating, Valve, Inspection)
  └── Work Type (e.g., Bundle Pulling, Pump Overhaul, Hydro Test)
```

Each Workpack Template references exactly one Work Type. This enables structured reporting, contractor summaries, and analytics without free-text ambiguity. Work Type belongs to Planning, not Asset Integrity.

### 3. Template Family Is Formalized

The existing `template_family_id` UUID on `workpack_templates` is promoted to a first-class `TemplateFamily` model. A Template Family groups related templates by equipment type and maintenance context:

```
Equipment Type: Heat Exchanger
  └── Template Family: Heat Exchanger Maintenance
        ├── Bundle Pulling
        ├── Bundle Replacement
        ├── Retubing
        ├── Cooling Water Cleaning
        └── Hydrocarbon Cleaning
```

The planner workflow becomes: Equipment → Equipment Type → Template Family → Template Selection.

### 4. AI Recommendations Target Templates, Not Strategies

All AI advisory logic shall recommend Workpack Templates with confidence scores, reasons, and previous TA references. AI SHALL NOT recommend Maintenance Strategies.

### 5. Future Asset Integrity Boundary

Asset Integrity is explicitly out of scope for M7. When implemented, the workflow will be:

```
Inspection → Remaining Life → Risk → Failure Mode → Recommended Workpack Template → Planner Review
```

Asset Integrity recommends Workpack Templates. It never introduces another reusable planning object.

---

## Alternatives Considered

### A. Keep MaintenanceStrategy as a First-Class Object

**Rejected.** This creates a parallel hierarchy to templates: planners would need to understand "which strategy" and "which template" and how they map. In practice, the template already encodes the full execution knowledge. A strategy without a template is unusable; a strategy with a template is redundant.

### B. Replace Strategy with Free-Text Work Category

**Rejected.** Free-text categories are inconsistent across templates, cannot be aggregated in reports, and provide no structure for planner navigation. A formal Work Type Master solves the categorization need without introducing a competing execution object.

### C. Merge Strategy Into Template

**Rejected as unnecessary.** The template already contains everything the strategy would. Adding strategy metadata (knowledge source, industry codes) to the template would bloat the model. Instead, Work Type and Template Family provide the lightweight classification layer.

---

## References

- M7.1–M7.5 implementation documentation
- M6.1–M6.2 Planning Foundation (Workpack Templates)
- M6.6 Hierarchy Audit
- ADR-0007 Enterprise Hierarchy
