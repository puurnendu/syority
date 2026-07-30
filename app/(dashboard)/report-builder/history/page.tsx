import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { GenerationHistory } from '../_components/GenerationHistory';

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const user = session.user as { role?: string; roles?: string[] };
  const rawRole = user?.role ?? user?.roles?.[0] ?? '';
  const role = String(rawRole).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

  if (!hasPermission(role, 'reporting:view')) redirect('/dashboard');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <GenerationHistory />
    </div>
  );
}
