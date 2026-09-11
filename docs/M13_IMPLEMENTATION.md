# M13 Implementation Plan: Turnaround Control Tower

## 1. Overview
M13 provides the Management Intelligence and Turnaround Control Tower layer. It orchestrates read-only queries across M8.13 (Progress), M11 (Schedule), and M12 (Execution) to deliver executive insights.

## 2. Core Architecture
- **Service Layer**: `ControlTowerQueryService.ts`
  - Acts as a unified facade for M13 dashboard queries.
  - Queries `WorkspaceQueryService` and `DimensionQueryBuilder` for data fetching.
  - Computes predictive metrics ("What is likely to become late?") by analyzing SPI/CPI (from M8.13) against Critical Path (from M11).
- **API Layer**: `/api/m13/control-tower/summary`
  - Tenant-scoped API to deliver aggregated dashboard metrics.
- **UI Layer**: `ControlTowerDashboard.tsx`
  - A refinery control tower UI focused on exceptions, S-Curves, and RAG status.

## 3. Key Deliverables
1. **ControlTowerQueryService.ts**: Aggregation logic enforcing Tenant Isolation and utilizing existing M8.13/M11/M12 authorities.
2. **Predictive Exceptions Engine**: Logic to identify activities that are not yet late but have degrading SPI (SPI < 1.0) and low float (Critical Path).
3. **M13 API Endpoint**: Secure, scope-aware data delivery.
4. **Dashboard View**: Clean, high-contrast, exception-oriented user interface.
5. **Tests**: Negative tests validating tenant isolation and read-only constraints.

## 4. Constraint Enforcement
- **Read-Only**: No `prisma.activity.update` or `ExecutionWriteService` calls will be made by M13 backend services.
- **Tenant Isolation**: `ControlTowerQueryService` will strictly enforce `organizationId` in all database interactions.
