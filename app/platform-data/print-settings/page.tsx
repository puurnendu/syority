import { requireDataAdminContext } from '@/lib/server-context';
import { PlatformDataComingSoon } from '../_components/PlatformDataComingSoon';

/**
 * workpackPrintSettings is not in the current Prisma schema.
 * Keep the route stable with Coming Soon instead of a runtime crash.
 */
export default async function PrintSettingsPage() {
    await requireDataAdminContext();
    return (
        <PlatformDataComingSoon
            featureName="Print & PDF Settings"
            icon="🖨️"
            description="Platform print header/footer and PDF cover design will be available here once the print-settings data model is connected. Tenant print settings remain available under Settings when proxying into a tenant."
        />
    );
}
