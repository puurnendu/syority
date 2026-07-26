import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CentralLessonsRegister } from '@/components/Central/CentralLessonsRegister';

export default async function LessonsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/auth/signin');
    return <CentralLessonsRegister />;
}
