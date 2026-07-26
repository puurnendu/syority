import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const url = new URL(req.url);
  const pipe_size = url.searchParams.get('pipe_size');
  const pressure_class = url.searchParams.get('pressure_class');
  const flange_type = url.searchParams.get('flange_type');

  if (pipe_size && pressure_class && flange_type) {
    const row = await prisma.gasketBoltLookup.findFirst({
      where: {
        organization_id: orgId,
        pipe_size,
        pressure_class,
        flange_type,
        is_active: true,
      },
      include: {
        gasket_item: {
          select: {
            id: true,
            item_code: true,
            description: true,
            sap_material_number: true,
          },
        },
        bolt_item: {
          select: {
            id: true,
            item_code: true,
            description: true,
            sap_material_number: true,
          },
        },
        nut_item: {
          select: {
            id: true,
            item_code: true,
            description: true,
            sap_material_number: true,
          },
        },
        washer_item: {
          select: {
            id: true,
            item_code: true,
            description: true,
          },
        },
      },
    });
    return NextResponse.json(row ?? null);
  }

  const rows = await prisma.gasketBoltLookup.findMany({
    where: { organization_id: orgId, is_active: true },
    include: {
      gasket_item: { select: { item_code: true, description: true } },
      bolt_item: { select: { item_code: true, description: true } },
      nut_item: { select: { item_code: true, description: true } },
    },
    orderBy: [
      { pipe_size: 'asc' },
      { pressure_class: 'asc' },
      { flange_type: 'asc' },
    ],
  });

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const body = await req.json().catch(() => null);
  if (
    !body?.pipe_size ||
    !body?.pressure_class ||
    !body?.flange_type
  ) {
    return NextResponse.json(
      {
        error:
          'pipe_size, pressure_class, flange_type are required',
      },
      { status: 400 }
    );
  }

  const row = await prisma.gasketBoltLookup.upsert({
    where: {
      organization_id_pipe_size_pressure_class_flange_type: {
        organization_id: orgId,
        pipe_size: body.pipe_size,
        pressure_class: body.pressure_class,
        flange_type: body.flange_type,
      },
    },
    update: {
      gasket_item_id: body.gasket_item_id ?? null,
      gasket_description: body.gasket_description ?? null,
      bolt_item_id: body.bolt_item_id ?? null,
      bolt_description: body.bolt_description ?? null,
      bolt_count: body.bolt_count != null ? parseInt(body.bolt_count, 10) : 4,
      bolt_length_mm:
        body.bolt_length_mm != null ? parseInt(body.bolt_length_mm, 10) : null,
      nut_item_id: body.nut_item_id ?? null,
      nut_description: body.nut_description ?? null,
      notes: body.notes ?? null,
    },
    create: {
      organization_id: orgId,
      pipe_size: body.pipe_size,
      pressure_class: body.pressure_class,
      flange_type: body.flange_type,
      gasket_item_id: body.gasket_item_id ?? null,
      gasket_description: body.gasket_description ?? null,
      bolt_item_id: body.bolt_item_id ?? null,
      bolt_description: body.bolt_description ?? null,
      bolt_count: body.bolt_count != null ? parseInt(body.bolt_count, 10) : 4,
      bolt_length_mm:
        body.bolt_length_mm != null ? parseInt(body.bolt_length_mm, 10) : null,
      nut_item_id: body.nut_item_id ?? null,
      nut_description: body.nut_description ?? null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(row, { status: 201 });
}
