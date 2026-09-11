import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import IdentityReviewQueueClient from './IdentityReviewQueueClient';

export default async function IdentityReviewQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(session.user as { organization_id?: string })?.organization_id) redirect('/login');
  return <IdentityReviewQueueClient />;
}
