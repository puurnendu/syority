import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { WhatsAppReviewsClient } from './_components/WhatsAppReviewsClient';

export const metadata = { title: 'WhatsApp Reviews — Intelligence' };

export default async function WhatsAppReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const user = session.user as { role?: string; roles?: string[] };
  const rawRole = user?.role ?? user?.roles?.[0] ?? '';
  const role = String(rawRole).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

  if (!hasPermission(role, 'reporting:view')) {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-gray-50">
      <WhatsAppReviewsClient />
    </div>
  );
}
