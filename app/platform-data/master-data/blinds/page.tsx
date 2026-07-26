import { requireDataAdminContext } from '@/lib/server-context';
import { PlatformDataComingSoon } from '../../_components/PlatformDataComingSoon';

export default async function BlindsPage() {
    await requireDataAdminContext();
    return (
        <PlatformDataComingSoon
            featureName="Blinds"
            icon="🛑"
            description="Platform blind catalog will be available with the Item Catalog. Use tenant Settings → Item Catalog while proxying for tenant-scoped items."
        />
    );
}
