/**
 * M7.6B/C/D — Provider Index
 *
 * Barrel export and bootstrap for all report data providers.
 * Automatically registers all built-in providers on import.
 *
 * M7.6D adds: 22 Planning Intelligence, 20 Safety Intelligence,
 * 12 Workforce Intelligence, 3 UDF Rollup providers (57 new = 84+ total).
 */

// ─── Core exports ───────────────────────────────────────────────────────────
export { BaseProvider, type ProviderContext, type ProviderMeta } from './BaseProvider';
export { providerRegistry, ProviderRegistryClass } from './ProviderRegistry';

// ─── Category exports (M7.6B/C) ────────────────────────────────────────────
export { planningProviders } from './PlanningProviders';
export { shutdownProviders } from './ShutdownProviders';
export { executionProviders } from './ExecutionProviders';
export { managementProviders } from './ManagementProviders';
export { platformProviders } from './PlatformProviders';
export { safetyProviders } from './SafetyProviders';
export { workforceProviders } from './WorkforceProviders';
export { workspaceProviders } from './WorkspaceProviders';

// ─── Intelligence exports (M7.6D) ──────────────────────────────────────────
export { planningIntelligenceProviders } from './PlanningIntelligenceProviders';
export { safetyIntelligenceProviders } from './SafetyIntelligenceProviders';
export { workforceIntelligenceProviders } from './WorkforceIntelligenceProviders';
export { udfRollupProviders } from './UDFRollupProviders';

// ─── Bootstrap ──────────────────────────────────────────────────────────────
import { providerRegistry } from './ProviderRegistry';
import { planningProviders } from './PlanningProviders';
import { shutdownProviders } from './ShutdownProviders';
import { executionProviders } from './ExecutionProviders';
import { managementProviders } from './ManagementProviders';
import { platformProviders } from './PlatformProviders';
import { safetyProviders } from './SafetyProviders';
import { workforceProviders } from './WorkforceProviders';
import { workspaceProviders } from './WorkspaceProviders';
import { planningIntelligenceProviders } from './PlanningIntelligenceProviders';
import { safetyIntelligenceProviders } from './SafetyIntelligenceProviders';
import { workforceIntelligenceProviders } from './WorkforceIntelligenceProviders';
import { udfRollupProviders } from './UDFRollupProviders';

// Register all built-in providers (84+ providers across 11 categories)
providerRegistry.registerAll([
  // M7.6B/C — 32 foundation providers
  ...planningProviders,
  ...shutdownProviders,
  ...executionProviders,
  ...managementProviders,
  ...platformProviders,
  ...safetyProviders,
  ...workforceProviders,
  ...workspaceProviders,
  // M7.6D — 57 intelligence providers
  ...planningIntelligenceProviders,
  ...safetyIntelligenceProviders,
  ...workforceIntelligenceProviders,
  ...udfRollupProviders,
]);

