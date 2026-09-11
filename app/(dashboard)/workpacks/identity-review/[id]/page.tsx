import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import IdentityReviewDetailClient from './IdentityReviewDetailClient';

export default async function IdentityReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const { id } = await params;
  return <IdentityReviewDetailClient workpackId={id} />;
}
