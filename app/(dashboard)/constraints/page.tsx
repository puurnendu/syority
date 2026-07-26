import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CentralConstraintRegister } from '@/components/Central/CentralConstraintRegister';

export default async function ConstraintsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/auth/signin');
    return <CentralConstraintRegister />;
}
