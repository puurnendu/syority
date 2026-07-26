import { requireDataAdminContext } from '@/lib/server-context';
import { PlatformDataComingSoon } from '../../_components/PlatformDataComingSoon';

export default async function ItemCatalogPage() {
    await requireDataAdminContext();
    return (
        <PlatformDataComingSoon
            featureName="Item Catalog"
            icon="📦"
            description="Platform-wide item catalog (gaskets, bolts, blinds, consumables) will be managed here. Tenant item catalogs remain available under Settings when proxying into a tenant."
        />
    );
}
