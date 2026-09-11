import { prisma } from '@/lib/prisma';

export async function generateJointMaterialLines(
  jointId: string,
  workpackId: string,
  organizationId: string,
  pipeSize: string,
  pressureRating: string,
  flangeType: string
) {
  const lookup = await prisma.gasket_bolt_lookup.findFirst({
    where: {
      organization_id: organizationId,
      pipe_size: pipeSize,
      pressure_class: pressureRating,
      flange_type: flangeType,
      is_active: true,
    },
  });

  await prisma.workpack_material_lines.updateMany({
    where: {
      workpack_id: workpackId,
      source_type: 'joint',
      source_id: jointId,
      deleted_at: null,
    },
    data: { deleted_at: new Date() },
  });

  if (!lookup) {
    await prisma.workpack_material_lines.create({
      data: {
        organization_id: organizationId,
        workpack_id: workpackId,
        source_type: 'joint',
        source_id: jointId,
        description: `Gasket — ${pipeSize} ${pressureRating} ${flangeType} (no catalog match)`,
        quantity_required: 1,
        unit_of_measure: 'EA',
        notes: 'Lookup not found — please assign manually',
      },
    });
    return { created: 1, lookup: false };
  }

  const linesToCreate: {
    organization_id: string;
    workpack_id: string;
    source_type: string;
    source_id: string;
    item_catalog_id: string | null;
    description: string;
    quantity_required: number;
    unit_of_measure: string;
  }[] = [];

  if (lookup.gasket_item_id || lookup.gasket_description) {
    linesToCreate.push({
      organization_id: organizationId,
      workpack_id: workpackId,
      source_type: 'joint',
      source_id: jointId,
      item_catalog_id: lookup.gasket_item_id,
      description: lookup.gasket_description ?? 'Gasket',
      quantity_required: 1,
      unit_of_measure: 'EA',
    });
  }

  if (lookup.bolt_item_id || lookup.bolt_description) {
    linesToCreate.push({
      organization_id: organizationId,
      workpack_id: workpackId,
      source_type: 'joint',
      source_id: jointId,
      item_catalog_id: lookup.bolt_item_id,
      description: lookup.bolt_description ?? 'Studs / Bolts',
      quantity_required: lookup.bolt_count,
      unit_of_measure: 'EA',
    });
  }

  if (lookup.nut_item_id || lookup.nut_description) {
    linesToCreate.push({
      organization_id: organizationId,
      workpack_id: workpackId,
      source_type: 'joint',
      source_id: jointId,
      item_catalog_id: lookup.nut_item_id,
      description: lookup.nut_description ?? 'Nuts',
      quantity_required: lookup.bolt_count * 2,
      unit_of_measure: 'EA',
    });
  }

  await prisma.workpack_material_lines.createMany({
    data: linesToCreate,
  });

  return {
    created: linesToCreate.length,
    lookup: true,
    gasket: lookup.gasket_description,
    bolts: lookup.bolt_count,
  };
}

export async function generateBlindMaterialLines(
  blindId: string,
  workpackId: string,
  organizationId: string,
  pipeSize?: string,
  pressureRating?: string
) {
  await prisma.workpack_material_lines.updateMany({
    where: {
      workpack_id: workpackId,
      source_type: 'blind',
      source_id: blindId,
      deleted_at: null,
    },
    data: { deleted_at: new Date() },
  });

  const desc =
    pipeSize && pressureRating
      ? `Gasket (blind isolation — ${pipeSize} ${pressureRating})`
      : 'Gasket (blind isolation)';

  await prisma.workpack_material_lines.create({
    data: {
      organization_id: organizationId,
      workpack_id: workpackId,
      source_type: 'blind',
      source_id: blindId,
      description: desc,
      quantity_required: 2,
      unit_of_measure: 'EA',
      notes: '2 gaskets required — one each face of blind',
    },
  });

  return { created: 1 };
}
