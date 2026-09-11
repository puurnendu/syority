/**
 * GET /api/asset-attribute-definitions — List attribute definitions
 * POST /api/asset-attribute-definitions — Create attribute definition (tenant-scoped)
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §3 (R2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { AssetRegisterService } from '@/core/asset-register';

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { searchParams } = new URL(request.url);

    const equipmentType = searchParams.get('equipment_type') || undefined;

    const definitions = await AssetRegisterService.getAttributeDefinitions(
      orgId,
      equipmentType
    );

    return NextResponse.json({ data: definitions });
  } catch (error: any) {
    console.error('[GET /api/asset-attribute-definitions]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attribute definitions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await guardApi('settings.org.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const body = await request.json();

    const { code, name, data_type, unit, equipment_types, group_name, group_sort_order, sort_order, is_required, is_design_basis, validation_rule, select_options, description } = body;

    if (!code || !name || !data_type) {
      return NextResponse.json({ error: 'code, name, and data_type are required' }, { status: 400 });
    }

    const definition = await AssetRegisterService.createAttributeDefinition({
      organization_id: orgId,
      code,
      name,
      data_type,
      unit,
      equipment_types,
      group_name,
      group_sort_order,
      sort_order,
      is_required,
      is_design_basis,
      validation_rule,
      select_options,
      description,
      created_by: session!.user.id,
    });

    return NextResponse.json({ data: definition }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/asset-attribute-definitions]', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A definition with this code already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create attribute definition' },
      { status: 500 }
    );
  }
}
