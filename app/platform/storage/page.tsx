import { requirePlatformContext } from '@/lib/server-context';
import { PlatformComingSoon } from '../_components/PlatformComingSoon';

export default async function PlatformStoragePage() {
    await requirePlatformContext();
    return (
        <PlatformComingSoon
            featureName="Platform Storage"
            icon="🗄️"
            description="Object storage configuration, usage quotas, and retention policies for the platform will be managed here."
        />
    );
}
