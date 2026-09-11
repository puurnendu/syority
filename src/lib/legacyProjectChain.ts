import { isFeatureEnabled } from '@/lib/features';

/**
 * Phase 0 (E2E lineage audit P0-8, roadmap item 5) — legacy /projects chain
 * quarantine.
 *
 * The pre-OD9 "Project as STO campaign" chain (legacy punch register on
 * `punch_items`, imported-schedule stubs, legacy AI daily report, retired
 * Project S-curve/EVM, legacy AI assistant) is reachable but broken or
 * retired. It is quarantined behind the LEGACY_PROJECT_CHAIN feature flag.
 *
 * Default is OFF: `isFeatureEnabled` returns false when the flag row does not
 * exist in `feature_flags_registry`, so existing deployments are quarantined
 * without any seed or migration.
 *
 * This flag does NOT gate the legitimate OD9.3 Project domain (Portfolio,
 * Project WBS, Project schedule/CPM, baselines, Project reports,
 * communications, constraints) — those are current product surfaces.
 */
export const LEGACY_PROJECT_CHAIN_FLAG = 'LEGACY_PROJECT_CHAIN';

export async function isLegacyProjectChainEnabled(organizationId?: string): Promise<boolean> {
  return isFeatureEnabled(LEGACY_PROJECT_CHAIN_FLAG, organizationId);
}

export const LEGACY_PROJECT_CHAIN_RETIRED = {
  error: 'LEGACY_PROJECT_CHAIN_RETIRED',
  message:
    'This endpoint belongs to the retired legacy Project chain (pre-OD9 STO-campaign ' +
    'Project surfaces). It is quarantined behind the LEGACY_PROJECT_CHAIN feature flag. ' +
    'STO functionality lives under Event-scoped surfaces; general project management ' +
    'lives under the Project domain (Portfolio → Project → WBS → Activity).',
} as const;
