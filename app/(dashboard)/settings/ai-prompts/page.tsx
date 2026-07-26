import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { AiPromptsClient } from './AiPromptsClient';

export default async function AiPromptsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  
  const role = (session.user as any)?.role ?? (session.user as any)?.roles?.[0] ?? '';
  if (!hasPermission(role, 'settings.org.view')) redirect('/dashboard');

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prompt Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the system prompts used by AI assistants across the platform. You can customize them or restore the system defaults.
        </p>
      </div>
      <AiPromptsClient />
    </div>
  );
}
