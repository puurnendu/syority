import { requireDataAdminContext } from '@/lib/server-context';
import { PlatformDataComingSoon } from '../../_components/PlatformDataComingSoon';

export default async function ConsumablesPage() {
    await requireDataAdminContext();
    return (
        <PlatformDataComingSoon
            featureName="Consumables"
            icon="🧴"
            description="Platform consumables catalog will be available with the Item Catalog. Use tenant Settings → Item Catalog while proxying for tenant-scoped items."
        />
    );
}
