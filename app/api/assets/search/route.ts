/**
 * GET /api/assets/search — Unified Asset Register search
 *
 * Query params:
 *   ?q=E-101 — full-text search across tag_number, name, description
 *   ?asset_type=heat_exchanger — filter by asset type
 *   ?system_id=xxx — filter by system
 *   ?attr_code=shell_design_press_barg&attr_op=gte&attr_value=10 — attribute filter
 *   ?limit=50&offset=0
 *
 * Architecture ref: M8.6 P1-004
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { AssetRegisterService } from '@/core/asset-register';

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const url = new URL(request.url);
    const q = url.searchParams.get('q') || undefined;
    const asset_type = url.searchParams.get('asset_type') || undefined;
    const system_id = url.searchParams.get('system_id') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Parse attribute filters: attr_code, attr_op, attr_value
    const attribute_filters: Array<{ code: string; op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte'; value: number | string }> = [];
    const attrCode = url.searchParams.get('attr_code');
    const attrOp = url.searchParams.get('attr_op') as 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | null;
    const attrValue = url.searchParams.get('attr_value');

    if (attrCode && attrOp && attrValue) {
      const numVal = Number(attrValue);
      attribute_filters.push({
        code: attrCode,
        op: attrOp,
        value: isNaN(numVal) ? attrValue : numVal,
      });
    }

    const results = await AssetRegisterService.searchAssets(orgId, {
      q,
      asset_type,
      system_id,
      attribute_filters,
      limit,
      offset,
    });

    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error('[GET /api/assets/search]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search assets' },
      { status: 500 }
    );
  }
}
