/**
 * M16 — Dimension Resolver
 *
 * Thin wrapper that delegates controlled value resolution to the
 * existing DimensionRegistry and ControlledValueResolver.
 *
 * This is SEPARATE from domain entity resolution (M16EntityResolver).
 *
 * Domain entities (equipment, workpack, activity) → M16EntityResolver
 * Controlled dimensions (discipline, equipment type) → DimensionResolver (this)
 *
 * AUTHORITY:
 *   - DimensionRegistry provides dimension metadata
 *   - ControlledValueResolver validates/resolves controlled values
 *   - This module does NOT calculate progress, CPM, or readiness
 */

import { DimensionRegistry } from '@/core/dimensions/DimensionRegistry';
import { ControlledValueResolver } from '@/core/governance/ControlledValueResolver';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DimensionResolution {
  resolved: boolean;
  id: string | null;
  code: string | null;
  name: string | null;
  source: 'dimension_registry' | 'controlled_value_resolver';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a discipline name/code to its authoritative record.
 * Uses ControlledValueResolver for governed value lookup.
 *
 * @param organizationId - Trusted org ID
 * @param hint           - Discipline name or code from user input
 */
export async function resolveDiscipline(
  organizationId: string,
  hint: string
): Promise<DimensionResolution> {
  try {
    const result = await ControlledValueResolver.resolveDiscipline(organizationId, hint);
    if (result) {
      return {
        resolved: true,
        id: result.id,
        code: result.code || null,
        name: result.name || null,
        source: 'controlled_value_resolver',
      };
    }
  } catch {
    // Fall through
  }

  return { resolved: false, id: null, code: null, name: null, source: 'controlled_value_resolver' };
}

/**
 * Resolve an equipment type hint to its authoritative record.
 *
 * @param organizationId - Trusted org ID
 * @param hint           - Equipment type name from user input
 */
export async function resolveEquipmentType(
  organizationId: string,
  hint: string
): Promise<DimensionResolution> {
  try {
    const result = await ControlledValueResolver.resolveEquipmentType(organizationId, hint);
    if (result) {
      return {
        resolved: true,
        id: result.id || null,
        code: result.code || null,
        name: result.name || null,
        source: 'controlled_value_resolver',
      };
    }
  } catch {
    // Fall through
  }

  return { resolved: false, id: null, code: null, name: null, source: 'controlled_value_resolver' };
}

/**
 * Get all available dimensions for a tenant.
 * Delegates to DimensionRegistry.getDefinitions().
 */
export async function getAvailableDimensions(organizationId: string) {
  return DimensionRegistry.getDefinitions(organizationId);
}
