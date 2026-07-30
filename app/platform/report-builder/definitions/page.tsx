import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DefinitionEditor } from '../_components/DefinitionEditor';

export default async function DefinitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const user = session.user as any;
  const isPlatform = ['platform_admin', 'platform_super_admin'].includes(
    String(user.role ?? '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  );
  if (!isPlatform) redirect('/dashboard');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <DefinitionEditor />
    </div>
  );
}
