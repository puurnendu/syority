import { requireDataAdminContext } from '@/lib/server-context';
import { PlatformDataComingSoon } from '../../_components/PlatformDataComingSoon';

export default async function BoltsPage() {
    await requireDataAdminContext();
    return (
        <PlatformDataComingSoon
            featureName="Bolts"
            icon="🔩"
            description="Platform bolt catalog will be available with the Item Catalog. Use tenant Settings → Item Catalog while proxying for tenant-scoped items."
        />
    );
}
