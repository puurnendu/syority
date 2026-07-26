import { requirePlatformContext } from '@/lib/server-context';
import { PlatformComingSoon } from '../_components/PlatformComingSoon';

export default async function PlatformLogsPage() {
    await requirePlatformContext();
    return (
        <PlatformComingSoon
            featureName="Platform Logs"
            icon="📜"
            description="Centralized platform audit and application logs across tenants will be viewable here."
        />
    );
}
