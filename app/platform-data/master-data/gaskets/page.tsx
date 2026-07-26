import { requireDataAdminContext } from '@/lib/server-context';
import { PlatformDataComingSoon } from '../../_components/PlatformDataComingSoon';

export default async function GasketsPage() {
    await requireDataAdminContext();
    return (
        <PlatformDataComingSoon
            featureName="Gaskets"
            icon="⭕"
            description="Platform gasket catalog will be available with the Item Catalog. Use tenant Settings → Item Catalog while proxying for tenant-scoped items."
        />
    );
}
