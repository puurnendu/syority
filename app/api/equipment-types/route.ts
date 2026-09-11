import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/equipment-types
 * Returns governed equipment types for current organization or platform standard library.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(req);
    // If unauthenticated or no org, allow read-only of active platform types for standard lookups
    const whereClause: any = { is_active: true };

    if (orgId) {
      whereClause.OR = [
        { org_id: orgId },
        { org_id: 'syority-platform' },
        { org_id: 'platform' },
      ];
    }

    let list = await prisma.equipmentType.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        is_active: true,
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });

    // Fallback if none found with specific filter: return all active
    if (list.length === 0) {
      list = await prisma.equipmentType.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          is_active: true,
        },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
      });
    }

    return NextResponse.json({ data: list, equipment_types: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
