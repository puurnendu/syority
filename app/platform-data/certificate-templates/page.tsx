import { requireDataAdminContext } from '@/lib/server-context';
import { CertificateTemplatesTab } from '@/components/Settings/CertificateTemplatesTab';

export default async function CertificateTemplatesSettingsPage() {
    await requireDataAdminContext();

    return (
        <div className="max-w-4xl p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Certificate Templates</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Manage platform and organisation certificate templates for workpack certificates.
                </p>
            </div>
            <CertificateTemplatesTab />
        </div>
    );
}
