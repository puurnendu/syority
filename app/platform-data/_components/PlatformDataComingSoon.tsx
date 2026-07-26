import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

type Props = {
    featureName: string;
    description: string;
    icon?: string;
};

export function PlatformDataComingSoon({ featureName, description, icon = '🚧' }: Props) {
    return (
        <ComingSoonPage
            featureName={featureName}
            description={description}
            icon={icon}
            backHref="/platform-data"
            backLabel="Back to Master Data Hub"
            relatedLinks={[
                { href: '/platform-data/master-data/equipment-types', label: 'Equipment Types', available: true },
                { href: '/platform-data/workpack-templates', label: 'Workpack Templates', available: true },
                { href: '/platform-data/certificate-templates', label: 'Certificate Templates', available: true },
            ]}
        />
    );
}
