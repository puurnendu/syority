import { prisma } from './prisma';

/**
 * Checks if a specific feature is enabled globally and/or for a specific organization.
 * 
 * Logic:
 * 1. If feature doesn't exist globally -> returns false.
 * 2. If feature is disabled globally -> returns false (Global kill switch).
 * 3. If organizationId is provided and an override exists -> returns override status.
 * 4. Otherwise -> returns global status.
 */
export async function isFeatureEnabled(key: string, organizationId?: string): Promise<boolean> {
  try {
    const globalFlag = await prisma.featureFlag.findUnique({
      where: { key },
      select: { isEnabled: true }
    });

    // Feature not defined or globally disabled
    if (!globalFlag || !globalFlag.isEnabled) {
      return false;
    }

    // Check for tenant-specific override
    if (organizationId) {
      const override = await prisma.tenantFeature.findUnique({
        where: {
          feature_key_organization_id: {
            feature_key: key,
            organization_id: organizationId
          }
        },
        select: { isEnabled: true }
      });

      if (override !== null) {
        return override.isEnabled;
      }
    }

    return globalFlag.isEnabled;
  } catch (error) {
    console.error(`Error checking feature flag ${key}:`, error);
    return false; // Default to false on error for safety
  }
}

/**
 * Fetches all enabled features for an organization for client-side use.
 */
export async function getEnabledFeatures(organizationId?: string): Promise<string[]> {
  try {
    const globalFlags = await prisma.featureFlag.findMany({
      where: { isEnabled: true },
      select: { key: true }
    });

    const enabledKeys: string[] = [];

    for (const flag of globalFlags) {
      if (await isFeatureEnabled(flag.key, organizationId)) {
        enabledKeys.push(flag.key);
      }
    }

    return enabledKeys;
  } catch (error) {
    console.error('Error fetching enabled features:', error);
    return [];
  }
}
