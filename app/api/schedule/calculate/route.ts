import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { normalizeUuid, isUuid } from '@/lib/uuid';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';

/**
 * POST /api/schedule/calculate
 *
 * M11-V1: Delegates CPM calculation to ScheduleOrchestrationService
 * (the SOLE authoritative CPM orchestration layer).
 *
 * Previously this route called calculateSchedule() directly, bypassing
 * CalendarEngine 3-tier resolution and the authoritative persistence logic.
 * Now all CPM flows through:
 *   API → ScheduleOrchestrationService → CalendarEngine → scheduleEngine.ts → Persistence
 *
 * Request body:
 *   - event_id: string (required) — the shutdown event to calculate
 *   - persist: boolean (optional, default true) — whether to persist CPM results
 *   - critical_float_threshold: number (optional, default 0) — float threshold in days
 *   - project_start_date: string (optional) — override start date
 *
 * Response preserves the existing API contract: { success, data: ScheduleCalculationResult }
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('nav.schedule');
    if (error) return error;

    const orgId = session.user.organization_id;
    const body = await req.json();

    const eventId = normalizeUuid(body.event_id);
    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json({ error: 'A valid event_id is required' }, { status: 400 });
    }

    // M11-V1: Delegate to ScheduleOrchestrationService (sole CPM authority)
    // This replaces the previous direct calculateSchedule() call + manual persistence
    const result = await ScheduleOrchestrationService.calculateEventSchedule(
      eventId,
      orgId,
      {
        persist: body.persist !== undefined ? Boolean(body.persist) : true,
        critical_float_threshold: body.critical_float_threshold !== undefined
          ? Number(body.critical_float_threshold)
          : 0,
        override_start_date: body.project_start_date
          ? new Date(body.project_start_date)
          : undefined,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'CPM calculation failed' },
        { status: result.error?.includes('not found') ? 404 : 500 }
      );
    }

    // Preserve existing API contract: { success, data }
    // The `data` field maps to the CPM calculation result for backward compat
    return NextResponse.json({
      success: result.success,
      data: result.calculation,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[POST /api/schedule/calculate] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to calculate schedule' }, { status: 500 });
  }
});
