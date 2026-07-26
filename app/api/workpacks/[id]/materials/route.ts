import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(req.url ?? '', 'http://localhost');
  const discipline = url.searchParams.get('discipline');
  const includedOnly = url.searchParams.get('includedOnly') === 'true';
  const grouped = url.searchParams.get('grouped') === 'true';

  const where: { workpack_id: string; deleted_at: Date | null; material_category?: string; includedInPdf?: boolean } = {
    workpack_id: id,
    deleted_at: null,
  };
  if (discipline) where.material_category = discipline;
  if (includedOnly) where.includedInPdf = true;

  const lines = await prisma.workpackMaterialLine.findMany({
    where,
    orderBy: [
      { material_category: 'asc' },
      { description: 'asc' },
      { created_at: 'asc' },
    ],
  });

  const consolidated: Record<
    string,
    {
      key: string;
      item_code: string | null;
      sap_number: string | null;
      description: string;
      specification: string | null;
      unit_of_measure: string;
      quantity: number;
      unit_cost: number | null;
      total_cost: number | null;
      currency: string | null;
      sources: string[];
      status: string;
    }
  > = {};

  for (const line of lines) {
    const key =
      line.item_catalog_id ?? line.description.toLowerCase().trim();
    if (consolidated[key]) {
      consolidated[key].quantity += line.quantity_required;
      consolidated[key].sources.push(line.source_type);
      if (line.procurement_status === 'not_requested') {
        consolidated[key].status = 'not_requested';
      }
    } else {
      // Safely access fields, ignoring the missing item_catalog relation
      consolidated[key] = {
        key,
        item_code: line.item_code ?? null,
        sap_number: line.sap_material_number ?? null,
        description: line.description,
        specification: line.specification ?? null,
        unit_of_measure: line.unit_of_measure,
        quantity: line.quantity_required,
        unit_cost: line.unit_cost ?? null,
        total_cost: null,
        currency: null,
        sources: [line.source_type],
        status: line.procurement_status,
      };
    }
  }

  for (const key of Object.keys(consolidated)) {
    const row = consolidated[key];
    if (row.unit_cost != null) {
      row.total_cost = row.quantity * row.unit_cost;
    }
  }

  const summary = {
    total_lines: lines.length,
    total_items: lines.reduce((s, l) => s + l.quantity_required, 0),
    from_joints: lines.filter((l) => l.source_type === 'joint').length,
    from_activities: lines.filter((l) => l.source_type === 'activity').length,
    from_blinds: lines.filter((l) => l.source_type === 'blind').length,
    from_ai: lines.filter((l) => l.source_type === 'ai').length,
    direct: lines.filter((l) => l.source_type === 'direct').length,
    estimated_cost: Object.values(consolidated).reduce(
      (s, r) => s + (r.total_cost ?? 0),
      0
    ),
  };

  if (grouped) {
    const activitiesRaw =
      lines.some((l) => l.source_type === 'activity' && l.source_id) &&
      (await prisma.activity.findMany({
        where: { workpack_id: id },
        select: { id: true, activity_id: true, activity_number: true, description: true },
      }));
    const activities = Array.isArray(activitiesRaw) ? activitiesRaw : [];
    const activityMap = new Map(
      activities.map((a) => [a.id, { activityId: a.activity_id ?? a.activity_number ?? '', description: a.description ?? '' }])
    );
    const groupedByDiscipline: Record<string, typeof lines> = {};
    for (const line of lines) {
      const disc = line.material_category ?? 'mechanical';
      if (!groupedByDiscipline[disc]) groupedByDiscipline[disc] = [];
      groupedByDiscipline[disc].push(line);
    }
    const materialsForGrouped = lines.map((l) => {
      const act = l.source_type === 'activity' && l.source_id ? activityMap.get(l.source_id) : null;
      return {
        id: l.id,
        description: l.description,
        customName: l.customName,
        discipline: l.material_category ?? 'mechanical',
        quantity: l.quantity_required,
        uom: l.unit_of_measure,
        specification: l.specification,
        includedInPdf: l.includedInPdf ?? true,
        aiGenerated: l.ai_generated,
        plannerNotes: l.plannerNotes,
        activity: act ?? { activityId: l.source_type === 'joint' ? l.linked_to : l.source_type, description: '' },
      };
    });
    const groupedShape: Record<string, typeof materialsForGrouped> = {};
    for (const m of materialsForGrouped) {
      if (!groupedShape[m.discipline]) groupedShape[m.discipline] = [];
      groupedShape[m.discipline].push(m);
    }
    return NextResponse.json({ materials: materialsForGrouped, grouped: groupedShape, lines, consolidated: Object.values(consolidated), summary });
  }

  return NextResponse.json({
    lines,
    consolidated: Object.values(consolidated),
    summary,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.description?.trim()) {
    return NextResponse.json(
      { error: 'Description is required' },
      { status: 400 }
    );
  }

  const sourceType = body.source_type === 'activity' && body.source_id ? 'activity' : 'direct';
  const sourceId = sourceType === 'activity' ? body.source_id : null;

  const line = await prisma.workpackMaterialLine.create({
    data: {
      organization_id: orgId,
      workpack_id: id,
      source_type: sourceType,
      source_id: sourceId,
      item_catalog_id: body.item_catalog_id ?? null,
      sap_material_number: body.sap_material_number ?? null,
      item_code: body.item_code ?? null,
      description: String(body.description).trim(),
      specification: body.specification ?? null,
      unit_of_measure: body.unit_of_measure ?? 'EA',
      material_category: body.material_category ?? 'mechanical',
      quantity_required:
        body.quantity_required != null
          ? parseFloat(body.quantity_required)
          : 1,
      procurement_status: body.procurement_status ?? 'not_requested',
      is_critical: body.is_critical ?? false,
      notes: body.notes ?? null,
      unit_cost:
        body.unit_cost != null ? parseFloat(body.unit_cost) : null,
    },
  });

  return NextResponse.json(line, { status: 201 });
}
