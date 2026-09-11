/**
 * GET /api/workspace/dimensions
 *
 * Returns all dimension definitions (system + tenant UDF) for the current
 * tenant. This is the single API consumers use to discover available
 * dimensions for column selection, filtering, sorting, grouping, export.
 *
 * Response: DimensionDefinition[]
 *
 * Consumed by:
 *   - Activity Grid column chooser
 *   - Gantt grouping controls
 *   - Filter builder
 *   - Export column selection
 *   - Report builder
 *   - AI query engine
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DimensionRegistry } from '@/core/dimensions';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as { organization_id: string };

  try {
    const dimensions = await DimensionRegistry.getDefinitions(user.organization_id);
    return NextResponse.json(dimensions);
  } catch (err: any) {
    console.error('[workspace/dimensions] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
