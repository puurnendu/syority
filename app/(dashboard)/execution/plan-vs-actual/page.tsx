import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PlanVsActualView } from '@/components/execution/PlanVsActualView';

export default async function PlanVsActualPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  return <PlanVsActualView />;
}
