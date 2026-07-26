import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { AiLogsClient } from './AiLogsClient';

export default async function AiLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  
  const role = (session.user as any)?.role ?? (session.user as any)?.roles?.[0] ?? '';
  if (!hasPermission(role, 'settings.org.view')) redirect('/dashboard');

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Usage Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor AI operations, token consumption, and performance metrics across your organization.
        </p>
      </div>
      <AiLogsClient />
    </div>
  );
}
