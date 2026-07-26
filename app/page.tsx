import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSystemReadiness } from '@/lib/system/readiness';

export default async function RootPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    if ((session.user as { must_change_password?: boolean }).must_change_password === true) {
        redirect('/auth/change-password');
    }

    // Check system readiness before redirecting
    const readiness = await getSystemReadiness();
    if (readiness.isReady) {
        redirect('/dashboard');
    } else {
        redirect('/admin/setup');
    }
}
