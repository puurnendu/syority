# M5.4 — Enterprise Demo Environment

**Seed:** `npm run seed:enterprise-demo`  
**Password (all users):** `Admin@123`

## Platform

| Field | Value |
|-------|--------|
| Company | SYORITY CORPORATION PVT LTD |
| Slug | `syority-platform` |

| Email | Role |
|-------|------|
| info@syority.com | Platform Super Admin |
| platform-pm@syority.test | Platform Product Manager |
| platform-scheduler@syority.test | Platform Master Scheduler |
| platform-support@syority.test | Platform Support |
| platform-finance@syority.test | Platform Finance |

## Tenants

| Tenant | Slug | Type | Site | Admin email |
|--------|------|------|------|-------------|
| Indian Oil Corporation Limited | iocl | Refinery Owner | Panipat Refinery | admin@iocl.test |
| HMEL | hmel | Refinery Owner | Bathinda Refinery | admin@hmel.test |
| L&T Energy Hydrocarbon | lnteh | Shutdown Contractor | LTEH Project Base | admin@lnteh.test |
| Technip Energies | technip | Engineering Contractor | Gurgaon office | admin@technip.test |
| Reliance Industries | ril | Refinery Owner | Jamnagar Refinery | admin@ril.test |

### Per-tenant users (local-part @ `{slug}.test`)

`admin`, `lead.planner`, `planner`, `scheduler`, `pm`, `mech.eng`, `elec.eng`, `inst.eng`, `civil.eng`, `exec.eng`, `qaqc`, `safety`, `materials`, `warehouse`, `doc.control`, `viewer`

## Hierarchy (refinery owners)

Process units: CDU, VDU, FCCU, HCU, CCR, Hydrogen Plant, SRU, Utilities, Tank Farm, Offsites, Cooling Water, Boilers, Electrical, Instrument Air, Fire Water — each with systems and tagged assets (`{SITE}-{TAG}`).

## Platform Standard Library (targets)

| Dataset | Target |
|---------|--------|
| Equipment Types | ≥100 |
| Activity Codes | ≥250 |
| Disciplines | 10 |
| Resource Types | ≥15 |
| UDF Definitions | ≥50 |
| Certificate Templates | ≥20 |
| Print presets (KE) | ≥20 |
| Workpack Templates | ≥40 |

## Knowledge Engine demo

Incoming, Review Queue, Approved, Rejected, AI Analysis samples with similarity / merge / duplicate suggestions.

## Files

- `prisma/seed-enterprise-demo.ts`
- `prisma/demo/*` data modules
- Canvas: `m5-4-enterprise-demo.canvas.tsx`
