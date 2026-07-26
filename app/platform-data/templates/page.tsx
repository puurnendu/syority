import { redirect } from 'next/navigation';
import { requireDataAdminContext } from '@/lib/server-context';

/**
 * Canonical Workpack Templates UI lives at /platform-data/workpack-templates.
 * Keep this route as a stable alias (nav historically pointed here).
 */
export default async function TemplatesAliasPage() {
    await requireDataAdminContext();
    redirect('/platform-data/workpack-templates');
}
