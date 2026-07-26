import { requirePlatformContext } from '@/lib/server-context';
import { PlatformComingSoon } from '../_components/PlatformComingSoon';

export default async function PlatformBackupsPage() {
    await requirePlatformContext();
    return (
        <PlatformComingSoon
            featureName="Platform Backups"
            icon="💾"
            description="Backup schedules, restore points, and disaster-recovery controls for the platform will be available here."
        />
    );
}
