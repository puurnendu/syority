import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { UnitTabs } from '@/components/unit/UnitTabs';

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ event_id?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');
  const role = (session.user as { role?: string; roles?: string[] })?.role ?? (session.user as { roles?: string[] })?.roles?.[0] ?? '';
  if (!hasPermission(role, 'unit:view')) redirect('/dashboard');

  const { unitId } = await params;
  const { event_id: eventId } = await searchParams;

  const eventInfo =
    eventId
      ? await prisma.event.findFirst({
          where: { id: eventId, organization_id: orgId, deleted_at: null },
          select: { id: true, name: true, code: true },
        })
      : null;

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organization_id: orgId },
    include: {
      site: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true, code: true } },
      _count: { select: { systems: true, workpacks: true } },
    },
  });

  if (!unit) notFound();

  const systemIds = await prisma.system
    .findMany({
      where: { unit_id: unitId },
      select: { id: true },
    })
    .then((s) => s.map((x) => x.id));

  const [equipmentCount, blindCount, openConstraintsCount] = await Promise.all([
    systemIds.length
      ? prisma.asset.count({
          where: { system_id: { in: systemIds }, deleted_at: null },
        })
      : 0,
    systemIds.length
      ? prisma.systemBlind.count({
          where: { system_id: { in: systemIds } },
        })
      : 0,
    systemIds.length
      ? prisma.constraint.count({
          where: {
            workpack: { system_id: { in: systemIds }, deleted_at: null },
            status: { in: ['open', 'in_progress'] },
            deleted_at: null,
          },
        })
      : 0,
  ]);

  const initialUnit = {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    description: unit.description,
    plant: unit.plant,
    site: unit.site,
    is_active: unit.is_active,
  };

  const initialKpi = {
    systems_count: unit._count.systems,
    equipment_count: equipmentCount,
    workpacks_count: unit._count.workpacks,
    blinds_count: blindCount,
    open_constraints_count: openConstraintsCount,
  };

  const canEdit = hasPermission(role, 'unit:edit');
  const canManage = hasPermission(role, 'unit:manage');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <UnitTabs
        unitId={unitId}
        initialUnit={initialUnit}
        initialKpi={initialKpi}
        initialEvent={eventInfo ?? null}
        canEdit={canEdit}
        canManage={canManage}
      />
    </div>
  );
}
