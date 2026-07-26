import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function NotificationsSettingsPage() {
  return (
    <ComingSoonPage
      featureName="Notification Settings"
      icon="🔔"
      description="Configure email, in-app, and SMS notifications for workpack status changes, hold point clearances, upcoming milestones, and approval workflows."
      plannedFor="Sprint 24"
      backHref="/settings"
      backLabel="Back to Settings"
      relatedLinks={[{ href: '/settings/users', label: 'Users & Roles', available: true }]}
    />
  );
}
