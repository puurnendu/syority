import { redirect } from 'next/navigation';
import { getSystemReadiness } from '@/lib/system/readiness';

/**
 * Layout for workpacks routes.
 * Checks system readiness and redirects to setup if not ready.
 * This protects /workpacks routes without modifying the Workpack module itself.
 */
export default async function WorkpacksLayout({ children }: { children: React.ReactNode }) {
    const readiness = await getSystemReadiness();
    
    // If system is not ready, redirect to setup
    if (!readiness.isReady) {
        redirect('/admin/setup');
    }

    return <>{children}</>;
}
