import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

type Props = {
    featureName: string;
    description: string;
    icon?: string;
};

/** Shared Coming Soon shell for unfinished Platform console routes. */
export function PlatformComingSoon({ featureName, description, icon = '🚧' }: Props) {
    return (
        <ComingSoonPage
            featureName={featureName}
            description={description}
            icon={icon}
            backHref="/platform/tenants"
            backLabel="Back to Tenants"
            relatedLinks={[
                { href: '/platform/tenants', label: 'Tenants', available: true },
                { href: '/platform/users', label: 'Platform Users', available: true },
                { href: '/platform/system', label: 'SMTP & System', available: true },
            ]}
        />
    );
}
