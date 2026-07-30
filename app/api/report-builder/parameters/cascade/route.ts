/**
 * M7.6B — Parameter Cascade API
 * POST: Resolve cascading parameter options based on parent selections.
 * Example: selecting a "unit" filters available "systems" and "assets".
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

const HIERARCHY_MAP: Record<string, { model: string; parentKey: string; labelField: string }> = {
  plant: { model: 'Plant', parentKey: 'site_id', labelField: 'name' },
  area: { model: 'Area', parentKey: 'plant_id', labelField: 'name' },
  unit: { model: 'Unit', parentKey: 'plant_id', labelField: 'name' },
  system: { model: 'System', parentKey: 'unit_id', labelField: 'name' },
  asset: { model: 'Asset', parentKey: 'system_id', labelField: 'name' },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { parentKey, parentValue, childKey } = await req.json();
    if (!parentKey || !parentValue || !childKey) {
      return NextResponse.json({ error: 'parentKey, parentValue, and childKey are required' }, { status: 400 });
    }

    const mapping = HIERARCHY_MAP[childKey];
    if (!mapping) {
      return NextResponse.json({ error: `Unknown child parameter: ${childKey}` }, { status: 400 });
    }

    // Dynamic Prisma query using the hierarchy
    const model = (prisma as any)[mapping.model];
    if (!model) {
      return NextResponse.json({ error: `Model not found: ${mapping.model}` }, { status: 400 });
    }

    const items = await model.findMany({
      where: {
        organization_id: session.user.organizationId,
        [mapping.parentKey]: parentValue,
        deleted_at: null,
      },
      select: { id: true, [mapping.labelField]: true, code: true },
      orderBy: { [mapping.labelField]: 'asc' },
    });

    const options = items.map((item: any) => ({
      value: item.id,
      label: item.code ? `${item.code} — ${item[mapping.labelField]}` : item[mapping.labelField],
    }));

    return NextResponse.json({ options });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
