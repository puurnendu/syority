import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  let orgId: string;
  try {
    orgId = orgScope(session!).orgId;
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  // OD9.2 §6: PROJECT and STO scope are separate parameters, never interchangeable.
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const eventId = url.searchParams.get('eventId') ?? undefined;

  // Diagnostic: log actual Workpack field names (remove after fixing search)
  try {
    const sampleWorkpack = await prisma.workpack.findFirst();
    console.log(
      '[Export Search] Sample workpack fields:',
      JSON.stringify(sampleWorkpack, null, 2)
    );
  } catch (e) {
    console.log('[Export Search] findFirst failed:', e);
  }

  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    // Minimal search: text fields only (schema: workpack_number, workpack_id_code, title, event_id, project_id)
    const where: Record<string, unknown> = {
      OR: [
        { workpack_number: { contains: q, mode: 'insensitive' } },
        { workpack_id_code: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
      ],
    };

    const scope: Record<string, unknown>[] = [];
    if (projectId) scope.push({ project_id: projectId });
    if (eventId) scope.push({ event_id: eventId });
    if (scope.length > 0) where.AND = scope;

    const workpacks = await prisma.workpack.findMany({
      where,
      take: 12,
    });

    console.log('[Export Search] Found:', workpacks.length, 'workpacks for query:', q);

    const workpackResults = workpacks.map((wp) => ({
      type: 'workpack' as const,
      id: wp.id,
      label: (wp.workpack_number ?? wp.workpack_id_code ?? wp.title) as string,
      sub: (wp.title ?? '') as string,
      workpackIds: [wp.id],
      actCount: 0,
    }));

    // Equipment types (optional, can fail if model differs)
    let equipTypes: { id: string; name: string }[] = [];
    try {
      // OD9.2: `EquipmentType` is tenant-scoped by `org_id`. The camelCase `orgId` meant
      // this always threw and equipment-type search silently returned nothing.
      equipTypes = await prisma.equipmentType.findMany({
        where: { org_id: orgId, name: { contains: q, mode: 'insensitive' } },
        take: 4,
      });
    } catch (err) {
      console.error('[Export] Equipment type search failed:', err);
    }

    const results = [
      ...workpackResults,
      ...equipTypes.map((et) => ({
        type: 'equipment_type' as const,
        id: `type:${et.id}`,
        label: `All ${et.name}s`,
        sub: `Add all ${et.name} workpacks at once`,
        workpackIds: [] as string[],
        equipTypeId: et.id,
        actCount: 0,
      })),
    ];

    return NextResponse.json({ results });
  } catch (e) {
    console.log('[Export Search] findMany error:', e);
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
