/**
 * GET /api/planner-workspace/validate
 *
 * Run all 19 validation rules against an event or workpack.
 * Query: ?eventId=<uuid> OR ?workpackId=<uuid>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ValidationEngineService } from '@/core/planner-workspace';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { organization_id: string };
  const eventId = req.nextUrl.searchParams.get('eventId') ?? undefined;
  const workpackId = req.nextUrl.searchParams.get('workpackId') ?? undefined;

  if (!eventId && !workpackId) {
    return NextResponse.json({ error: 'eventId or workpackId required' }, { status: 400 });
  }

  try {
    const issues = await ValidationEngineService.validate({
      organizationId: user.organization_id,
      eventId,
      workpackId,
    });

    return NextResponse.json({
      issues,
      summary: ValidationEngineService.summarize(issues),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
