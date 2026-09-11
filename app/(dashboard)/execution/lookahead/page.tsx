import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LookaheadView } from '@/components/execution/LookaheadView';

export default async function LookaheadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  return <LookaheadView />;
}
