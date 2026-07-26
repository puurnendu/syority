import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ChangePasswordForm } from './ChangePasswordForm';

/**
 * Server gate (defense in depth with middleware):
 * - anonymous → /login
 * - authenticated + must_change_password → render form
 * - authenticated + normal → /dashboard
 */
export default async function ChangePasswordPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect('/login');
    }

    const mustChange = (session.user as { must_change_password?: boolean }).must_change_password === true;
    if (!mustChange) {
        redirect('/dashboard');
    }

    return <ChangePasswordForm />;
}
