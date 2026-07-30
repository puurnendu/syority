/**
 * M7.6B — From Workspace API
 * POST: Map planner workspace filters to report parameters.
 * Captures the current workspace filter state and returns matching definitions
 * with pre-filled parameters.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:build')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { filters } = await req.json();
    if (!filters) return NextResponse.json({ error: 'Workspace filters are required' }, { status: 400 });

    // Map workspace filters to report parameter keys
    const reportParams: Record<string, any> = {};
    if (filters.siteId) reportParams.site = filters.siteId;
    if (filters.plantId) reportParams.plant = filters.plantId;
    if (filters.unitId) reportParams.unit = filters.unitId;
    if (filters.systemId) reportParams.system = filters.systemId;
    if (filters.eventId) reportParams.event = filters.eventId;
    if (filters.contractorId) reportParams.contractor = filters.contractorId;
    if (filters.disciplineId) reportParams.discipline = filters.disciplineId;

    // Find applicable report definitions
    const definitions = await prisma.report_definitions.findMany({
      where: {
        is_active: true,
        is_draft: false,
        OR: [
          { organization_id: session.user.organizationId },
          { organization_id: null },
        ],
      },
      include: {
        category: { select: { name: true, slug: true } },
        sections: { select: { key: true, name: true, is_default: true } },
      },
      orderBy: [{ category: { sort_order: 'asc' } }, { name: 'asc' }],
    });

    // Return definitions with pre-filled parameters
    const result = definitions.map((def) => ({
      definitionId: def.id,
      slug: def.slug,
      name: def.name,
      category: def.category.name,
      prefilledParameters: reportParams,
      defaultSections: def.sections.filter((s) => s.is_default).map((s) => s.key),
    }));

    return NextResponse.json({ definitions: result, parameters: reportParams });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
