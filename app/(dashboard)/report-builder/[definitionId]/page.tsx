import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { ReportConfigurator } from '../_components/ReportConfigurator';

export default async function ReportConfigPage({ params }: { params: Promise<{ definitionId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const user = session.user as { role?: string; roles?: string[] };
  const rawRole = user?.role ?? user?.roles?.[0] ?? '';
  const role = String(rawRole).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

  if (!hasPermission(role, 'reporting:view')) {
    redirect('/dashboard');
  }

  const { definitionId } = await params;
  const canBuild = hasPermission(role, 'reporting:build');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <ReportConfigurator definitionId={definitionId} canBuild={canBuild} />
    </div>
  );
}
