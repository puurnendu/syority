import { redirect } from 'next/navigation';
import { requireDataAdminContext } from '@/lib/server-context';
import UdfDefinitionsClient from './UdfDefinitionsClient';

export const revalidate = 0;

export default async function UdfDefinitionsPage() {
    const session = await requireDataAdminContext();

    const orgId = session.active_tenant_id;
    if (!orgId) redirect('/platform/tenants');

    return <UdfDefinitionsClient />;
}
