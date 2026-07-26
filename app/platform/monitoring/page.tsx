import { requirePlatformContext } from '@/lib/server-context';
import { PlatformComingSoon } from '../_components/PlatformComingSoon';

export default async function PlatformMonitoringPage() {
    await requirePlatformContext();
    return (
        <PlatformComingSoon
            featureName="Platform Monitoring"
            icon="📡"
            description="Service health, latency, and alerting for the platform infrastructure will be surfaced here."
        />
    );
}
