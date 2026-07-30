import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { ScheduleManager } from '../_components/ScheduleManager';

export default async function SchedulesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const user = session.user as { role?: string; roles?: string[] };
  const rawRole = user?.role ?? user?.roles?.[0] ?? '';
  const role = String(rawRole).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

  if (!hasPermission(role, 'reporting:build')) redirect('/dashboard');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <ScheduleManager />
    </div>
  );
}
