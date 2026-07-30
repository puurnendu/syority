# Module Management Guide

## Overview

Aurianoa OS modules are controlled through the Module Management system (M7.6G). Platform admins can enable, disable, or restrict modules per organization.

## Module Catalog (22 Modules)

### Core (Cannot Be Disabled)
| Module | Slug | Description |
|--------|------|-------------|
| 🔐 Authentication | `authentication` | Login and session management |
| 🛡️ Authorization | `authorization` | RBAC and permissions |
| 🏢 Organization Management | `organization` | Org settings and configuration |
| 👥 User Management | `user_management` | User CRUD and roles |

### Planning
| Module | Slug |
|--------|------|
| 🏭 Digital Plant | `digital_plant` |
| ⚙️ Asset Register | `asset_register` |
| 🔧 Engineering Issues | `engineering_issues` |
| 📋 Shutdown Scope | `shutdown_scope` |
| 📐 Planner Workspace | `planner_workspace` |

### Intelligence
| Module | Slug |
|--------|------|
| 🧠 Workpack Intelligence | `workpack_intelligence` |
| 📚 Knowledge Engine | `knowledge_engine` |
| 🔔 Notification Platform | `notification_platform` |
| 📊 Report Builder | `report_builder` |
| 📄 Report Engine | `report_engine` |
| 📈 OIS | `ois` |
| ⚡ Business Rules Engine | `bre` |

### Safety
| Module | Slug |
|--------|------|
| 🦺 Safety Management | `safety` |

### Future (Coming Soon)
| Module | Slug |
|--------|------|
| 🚀 Execution Management | `execution` |
| 🔩 Asset Integrity | `asset_integrity` |
| 📉 Reliability | `reliability` |
| 🔮 Predictive Maintenance | `predictive_maintenance` |

## Module Statuses

| Status | Description |
|--------|-------------|
| `enabled` | Fully accessible |
| `disabled` | Hidden from users |
| `hidden` | Removed from navigation |
| `beta` | Accessible with beta flag |
| `coming_soon` | Visible but not functional |
| `experimental` | Unstable, for testing only |

## API

```
GET  /api/admin/modules?organizationId=...  — Modules with org status
POST /api/admin/modules { action: 'seed' }   — Seed catalog
POST /api/admin/modules { action: 'initialize', organizationId }
PATCH /api/admin/modules { organizationId, moduleId, status }
```

## Service

```typescript
import { moduleService } from '@/core/platform/ModuleService';

// Check module access
const enabled = await moduleService.isModuleEnabled(orgId, 'ois');

// Get all enabled modules
const modules = await moduleService.getEnabledModules(orgId);

// Initialize for new org
await moduleService.initializeForOrganization(orgId);
```
