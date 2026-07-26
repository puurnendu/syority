import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UnitDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ unitId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  if (!hasPermission((session.user as any)?.role ?? (session.user as any)?.roles?.[0], 'unit:view'))
    redirect('/dashboard');

  const { unitId } = await params;
  if (unitId === 'new' || !UUID_REGEX.test(unitId)) {
    redirect('/planning/units');
  }
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organization_id: orgId },
    select: { id: true, name: true, code: true },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-none px-4 sm:px-6 py-2 bg-white border-b border-gray-200">
        <p className="text-sm text-gray-500">
          <Link href="/planning/units" className="hover:text-gray-700">
            Planning
          </Link>
          {' > '}
          <Link href="/planning/units" className="hover:text-gray-700">
            Units
          </Link>
          {unit && (
            <>
              {' > '}
              <Link href={`/planning/units/${unit.id}`} className="text-gray-900 font-medium">
                {unit.name}
              </Link>
            </>
          )}
        </p>
      </div>
      {children}
    </div>
  );
}
