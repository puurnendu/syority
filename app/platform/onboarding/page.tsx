import { requirePlatformContext } from '@/lib/server-context';
import { PlatformComingSoon } from '../_components/PlatformComingSoon';

/**
 * OnboardingRequest is not present in the current Prisma schema.
 * Keep the route stable with Coming Soon instead of a runtime crash.
 */
export default async function OnboardingAdminPage() {
    await requirePlatformContext();
    return (
        <PlatformComingSoon
            featureName="Tenant Onboarding"
            icon="📝"
            description="Review and approve new organization registration requests. This workflow will be reconnected once the onboarding data model is available."
        />
    );
}
