import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function AuditLogsPage() {
  return (
    <ComingSoonPage
      featureName="Audit Logs"
      icon="📜"
      description="View and export organisation audit trails for compliance and change history. This section is being built."
      plannedFor="Sprint 25"
      backHref="/settings"
      backLabel="Back to Settings"
      relatedLinks={[
        { href: '/settings/users', label: 'Users & Roles', available: true },
        { href: '/settings/organization', label: 'Organisation Settings', available: true },
      ]}
    />
  );
}
