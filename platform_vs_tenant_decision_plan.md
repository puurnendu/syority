# Architectural Decision Plan: Platform vs Tenant Management (Finalized)

Following the audit and initial draft, this document summarizes the finalized architectural rules for the Platform/Tenant separation.

## 1. Feature Ownership & AI Hierarchy

### AI Configuration Inheritance
Logic: **Tenant Override > Platform Default**
1.  **Platform Default**: Global fallback key (e.g., Vertex AI).
2.  **Tenant Override (BYOK)**: Customer-provided keys.
*Refinement*: If a tenant provides a key, it is ALWAYS used. If blank, system falls back to Platform Default.

| Feature Area | Owner | Rationale |
|:---|:---|:---|
| **Tenant Lifecycle** | Platform | Only Super-Admins can create/suspend tenants. |
| **Feature Flags** | Platform | Global entitlement control (SKU gating). |
| **System Monitoring** | Platform | Infrastructure and cross-tenant health. |
| **Org Profile & Data**| Tenant | Customer-owned information. |
| **Access Keys** | Tenant | Optional "Bring Your Own Key" (BYOK) overrides. |

## 2. Refined Permission Boundaries (Proxy Mode)

Platform Admins do **not** have ambient "Full Access" to tenant data. All cross-tenant interactions must be performed via an explicit **Proxy Session**.

| Feature | Platform Admin | Org Admin | Planner / User |
|:---|:---|:---|:---|
| **Platform Portal** | Full Access | No Access | No Access |
| **Tenant Content** | **Proxy Mode Only** | Full Access | Partial (Role-based) |
| **Master Data** | **View Only** | Full Access | View Only |

*Refinement*: Master Data (Items, Assets, etc.) can only be edited by a Platform Admin if they have explicitly entered **Proxy Mode** for that tenant.

### Session Context Schema
The application session/state object must include:
```typescript
interface SessionContext {
  user_id: string;
  role: string;
  mode: 'platform' | 'tenant'; // Current UI focus
  active_tenant_id: string;   // Tenant currently being managed
  is_proxy: boolean;          // True if platform_admin is acting as tenant
}
```
*Safeguard*: Only a user with the `platform_admin` (or `platform_super_admin`) role is permitted to set `is_proxy = true`. An `org_admin` cannot access other tenants.

### Extended Audit Logging Rule
Any action performed by a **Platform Admin** while `is_proxy: true` must be strictly logged:
*   **Write Operations**: Must log `user_id`, `original_role`, `target_tenant_id`, `action_type`, and `meta_data` (diff of changes).
*   **Read Operations**: Optionally log sensitive read actions (e.g., viewing user lists, financial data) for compliance purposes.

## 3. Standardized Route Structure & Guards

Namespaces are strictly enforced via middleware/guards.

| Namespace | Access Group | Mode Enforcement | Default Landing |
|:---|:---|:---|:---|
| **`/platform/*`** | `platform_admin` | `mode: 'platform'` only | `/platform/tenants` |
| **`/dashboard`** | All | `mode: 'tenant'` only | `/dashboard` |

### Route Consistency Enforcement
Navigating to any `/platform/*` route forces the session to reset its context:
*   `mode = 'platform'`
*   `active_tenant_id = null`
*   `is_proxy = false`

This ensures a platform admin cannot accidentally carry tenant context into the global platform realm.

### Session Rehydration & Tenant Validation
Every request within `mode: 'tenant'`, and importantly **on application load/refresh**, must undergo validation:
1.  **Rehydration Check**: Validate `active_tenant_id` exists and the user is authorized to access it. If invalid, reject and reset the session context to a safe default.
2.  **Status Guard**: Block access to the tenant if its `status === 'SUSPENDED'`, redirecting users to a "Suspended" page.
    *   *Override*: `platform_admin` users operating in Proxy Mode bypass this block for troubleshooting purposes.

### Direct URL Handling (Missing Context)
If a user navigates directly to `/dashboard` without an active tenant context in their session:
*   **Platform Admin**: Redirect to `/platform/tenants`. (Forces the admin to explicitly select a tenant and enter Proxy Mode).
*   **Org Admin / User**: Automatically resolve and load their assigned `tenant_id`.

### Tenant Ownership Enforcement
*   An `org_admin` or standard user is irrevocably bound to their assigned `organization_id` at the database level.
*   The runtime environment must strictly prevent manual tenant switching (e.g., via URL manipulation or API payload tampering). These roles are completely prevented from accessing or modifying another tenant's context.

## 4. Context Switch & Flow Model

### Tenant Entry Flow (Proxy Start)
1.  Admin lands on `/platform/tenants`.
2.  Admin selects a Tenant.
3.  System updates Session: `active_tenant_id = ID`, `mode = 'tenant'`, `is_proxy = true`.
4.  Redirect to `/dashboard` with Proxy Banner enabled.

### Proxy Exit Mechanism
1.  Admin clicks **"Exit Proxy Mode"** in the global banner.
2.  System updates Session: `active_tenant_id = null`, `mode = 'platform'`, `is_proxy = false`.
3.  Redirect to `/platform/tenants`.

### AI Fallback & Validation
1.  Attempt execution using **Tenant Override (BYOK)**.
2.  If key fails (Invalid/Expired):
    *   **Fallback** to Platform Default.
    *   **Log Warning**: `Tenant AI Key Failure: {tenant_id}`.
    *   Notify Org Admin (via Dashboard Alert) that their override is failing.

## 5. Execution Roadmap (Prioritized)

### Phase 1: Context & Routes (Critical)
*   Implement `/platform` namespace and move existing super-admin pages there.
*   Update `middleware.ts` / `layout.tsx` to strictly guard platform routes.
*   Implement landing page redirection logic in `/login` and `/`.

### Phase 2: User & AI Config (Critical)
*   Split the "AI Configuration" UI into "Global Defaults" (Platform) and "Provider Keys" (Tenant Settings).
*   Correct the "Platform Users" UI to focus on global management vs local organization users.

### Phase 3: Proxy Mode & Logging (Medium)
*   Implement the "Proxy Mode" banner and the interceptor logic for audit logging platform actions.
*   Enable the logo/primary color overrides in `settings/profile`.
