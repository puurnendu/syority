import { redirect } from 'next/navigation';
import { requirePlatformContext } from '@/lib/server-context';
import { prisma } from '@/lib/prisma';
import { AiConfigPage } from './AiConfigPage';

export default async function Page() {
    const session = await requirePlatformContext();

    // Note: since this originally hit organization_id, we just get it from old db format or platform mode? 
    // Wait, platform mode might have active_tenant_id = null. 
    // However, AI configs were tied to a specific organization.
    // If the platform admin modifies "global AI", maybe orgId isn't needed or we use a hardcoded fallback tenant?
    // Let's use session.active_tenant_id if proxy, or a fallback.
    const orgId = session.active_tenant_id || "SYSTEM";
    
    // For now we skip crashing if orgId is SYSTEM or we lookup gracefully.
    let data = null;
    if (orgId !== "SYSTEM") {
        const settings = await prisma.aiProviderSetting.findUnique({
            where: { organization_id: orgId },
        });
        data = settings ? JSON.parse(JSON.stringify(settings)) : null;
    }

    return <AiConfigPage existing={data} orgId={orgId} />;
}
