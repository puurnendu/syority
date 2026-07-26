# Platform vs Tenant Management Audit

This report summarizes the findings of a structured audit focused on the separation of Platform-level (Multi-tenant/Super-Admin) and Tenant-level (Organization-specific) features and navigation.

## 1. Navigation Audit

| Feature | Location(s) | Scope | Notes |
|:---|:---|:---|:---|
| **Manage Tenants** | Top Nav (Tenants), Admin Sidebar | Platform | Primary multi-tenant dashboard. |
| **Onboarding Requests** | Top Nav (Tenants), Admin Sidebar | Platform | Signup/Approval queue. |
| **AI Configuration** | Top Nav (Platform), Settings Sidebar | Platform/Tenant | Conflicting scoping logic; currently tenant-bound but global-looking. |
| **Platform Users** | Top Nav (Platform), Admin Sidebar | Platform | Manages all users in the system; naming suggests Platform team only. |
| **Platform Billing** | Top Nav (Platform), Admin Sidebar | Platform | Parent account finances. |
| **System Monitoring** | Top Nav (Platform), Admin Sidebar, Settings Sidebar | Platform | "System" in Settings is a placeholder ("Soon"). |
| **Feature Flags** | Top Nav (Platform), Admin Sidebar | Platform | Entitlement management for tenants. |
| **Organization Settings** | Settings Sidebar, Top Nav (Admin) | Tenant | Organization profile (Tenant admin). |
| **Users** | Settings Sidebar, Top Nav (Admin) | Tenant | Team management for the specific org. |
| **Roles & Permissions** | Settings Sidebar | Tenant | Organization-specific RBAC. |
| **Master Data** | Settings Sidebar | Tenant | Activity codes, Disciplines, Resources, Items. |
| **Equipment Types** | Admin Sidebar | Tenant | **Misplaced**: Currently in `/admin` instead of `/settings`. |
| **Workpack Columns** | Admin Sidebar | Platform | Marked `platformOnly`; should likely be tenant-specific. |

## 2. Duplication & Confusion Highlights

### Exact Duplication
*   **Manage Tenants / Onboarding**: Users can access these via the "Tenants" dropdown in the top navigation OR via the "Admin Panel" sidebar. This creates redundancy and visual noise for Super Admins.
*   **AI Configuration**: Appears in both the Platform top-nav menu and the "System" section of the Tenant Settings sidebar.

### Ambiguous Naming
*   **Users vs Platform Users**:
    *   `settings/users` manages the current organization's team.
    *   `admin/users` (labeled "Platform Users") manages *all* users across *all* tenants.
    *   Risk: A Platform Admin might accidentally edit a tenant user thinking they are managing the platform team.

### Scoping Confusion
*   **AI Configuration**: The page `/settings/ai-config` is used as a "Platform" item in the top nav, but the underlying API saves configurations to the *current user's organization*. A platform admin cannot use this page to configure AI for a specific client tenant without impersonation.

## 3. Responsibility & Authority Matrix

| Layer | Primary User | Logic Context | Ownership |
|:---|:---|:---|:---|
| **Platform** | Super Admin | Cross-tenant / System Global | Syority Platform Team |
| **Tenant** | Org Admin | Organization / Internal | The Client Organization |
| **Project** | Planner / PM | Workspace / Data specific | Project Stakeholders |

## 4. Organisation (Tenant) Capability Audit

### Existing Features
- [x] Basic Organization Profile (Slug/Name)
- [x] User Management (Invite/Delete)
- [x] Sites Management (Locations)
- [x] Role/Permission Overview (Partial)
- [x] Master Data (Disciplines, Items, Assets)

### Partially Implemented / Placeholder
- [ ] **Subscription/Billing**: UI exists as "Soon" or redirects to global platform billing. No tenant-specific subscription tier selection.
- [ ] **System/Audit Logs**: Sidebar item exists but UI is empty or limited.
- [ ] **AI Config Override**: Global settings exist, but the UI for a tenant to "Use Syority Defaults" vs "Bring Your Own Key" is unclearly separated.

### Missing Features
- [ ] **Organization Branding**: Tenant-specific logos and colors (only global superadmin branding currently exists).
- [ ] **Audit Trail**: Tracking when an Org Admin changes their own settings or users.
- [ ] **Resource Import/Export**: Tools for bulk onboarding of tenant data (employees, equipment list).

## 5. Route & Structure Audit

*   **Redundant Layouts**: `AdminLayout` and `NavBar` both define the same platform navigation list, leading to desync risks (e.g., icons in sidebar vs text in dropdown).
*   **Inconsistent Naming**:
    *   `/admin/tenants` (Good)
    *   `/settings/organization` (Good)
    *   `/admin/equipment-types` (**Inconsistent**: This is master data, should be `/settings/master-data/equipment-types`).
*   **Route Misplacement**: `/admin/org/workpack-columns` uses an `/admin` prefix for a feature that feels like a Tenant Settings preference.

## 6. UX Clarity Gaps

1.  **Context Switching**: There is no clear visual indicator when a Platform Admin is viewing the "Platform Context" (managing all clients) vs their own "Tenant Context" (managing Syority internal project data).
2.  **Navigation Overlap**: When on an `/admin` page, the Top Nav still shows "Admin" and "Tenants" dropdowns, creating a circular navigation loop.
3.  **Role Feedback**: Admins are NOT warned when a setting they change (like Feature Flags) will immediately affect all tenants globally vs just one.

---

## 7. Recommended Structure (High-Level Only)

### Proposed UI Separation

1.  **Platform Mode (Portal)**:
    *   Accessible only to `platform_admin`.
    *   Dedicated Layout (No project navigation).
    *   Focus: Tenants, Growth, Global Features, System Status, Global AI defaults.
2.  **Tenant Mode (Workspace Settings)**:
    *   Accessible to `tenant_admin` and `platform_admin` (via proxy).
    *   Sidebar-centric layout (current `SettingsSidebar` model).
    *   Focus: Org profile, Org Users, Org Sites, Master Data, Integration keys, Subscription status.

### Route Refactoring Idea
*   **Platform**: `/platform/*` (e.g., `/platform/tenants`, `/platform/users`).
*   **Tenant**: `/settings/*` (e.g., `/settings/users`, `/settings/data`).
*   **Master Data**: Consolidate all technical catalogs under `/settings/master-data/*`.
