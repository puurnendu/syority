import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ExecutionCockpit } from '@/components/execution/ExecutionCockpit';

export default async function ExecutionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  return <ExecutionCockpit />;
}
