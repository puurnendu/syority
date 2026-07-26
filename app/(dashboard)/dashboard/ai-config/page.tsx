import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AiConfigForm } from './AiConfigForm';

export default async function AiConfigPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    const user = session.user as any;
    const orgId = user.organization_id;

    // Fetch existing AI provider settings
    const settings = await prisma.aiProviderSetting.findUnique({
        where: { organization_id: orgId },
    });

    const data = settings ? JSON.parse(JSON.stringify(settings)) : null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
                <p className="text-sm text-gray-500 mt-1">Configure AI providers for workpack generation and document extraction.</p>
            </div>
            <AiConfigForm existing={data} orgId={orgId} />
        </div>
    );
}
