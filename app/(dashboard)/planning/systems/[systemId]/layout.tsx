import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function SystemDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ systemId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  if (!hasPermission((session.user as any)?.role ?? (session.user as any)?.roles?.[0], 'system:view')) redirect('/dashboard');

  const { systemId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true, name: true, code: true },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-none px-4 sm:px-6 py-2 bg-white border-b border-gray-200">
        <p className="text-sm text-gray-500">
          <Link href="/planning/systems" className="hover:text-gray-700">Planning</Link>
          {' > '}
          <Link href="/planning/systems" className="hover:text-gray-700">Systems</Link>
          {system && (
            <>
              {' > '}
              <Link href={`/planning/systems/${system.id}`} className="text-gray-900 font-medium">{system.name}</Link>
            </>
          )}
        </p>
      </div>
      {children}
    </div>
  );
}
