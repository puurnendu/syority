import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { WhatsAppConfigForm } from './WhatsAppConfigForm';

export default async function WhatsAppSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  
  const role = (session.user as any)?.role ?? (session.user as any)?.roles?.[0] ?? '';
  if (!hasPermission(role, 'settings.org.view')) redirect('/dashboard');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your WhatsApp Cloud API credentials to enable automated messaging, inbound webhook routing, and AI parsing.
        </p>
      </div>
      <WhatsAppConfigForm />
    </div>
  );
}
