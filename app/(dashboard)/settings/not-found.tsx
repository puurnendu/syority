import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function SettingsNotFound() {
  return (
    <ComingSoonPage
      featureName="Feature Not Available Yet"
      icon="🔧"
      description="This settings section is either planned for a future sprint or is being built right now. Check back soon — new features are being added regularly."
      backHref="/settings"
      backLabel="Back to Settings"
      relatedLinks={[
        { href: '/settings/organization', label: 'Organisation', available: true },
        { href: '/settings/users', label: 'Users & Roles', available: true },
        { href: '/settings/udf-definitions', label: 'UDF Definitions', available: true },
        { href: '/settings/templates', label: 'Templates', available: true },
        { href: '/settings/clearance-parties', label: 'Clearance Parties', available: true },
        { href: '/settings/print-settings', label: 'Print & PDF Design', available: true },
        { href: '/settings/master-data/activity-codes', label: 'Activity Codes', available: true },
      ]}
    />
  );
}
