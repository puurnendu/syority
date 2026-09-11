import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { normalizeUuid, isUuid } from '@/lib/uuid';
import { createActivity } from '@/core/activity/ActivityCreationCommand';
import { ActivityIdentityError } from '@/core/activity/ActivityIdentityError';
import { ControlledValidationError } from '@/core/governance/ControlledValueResolver';
import {
  listedPlannedDateFields,
  PLANNED_DATE_REJECT_MESSAGE,
} from '@/core/schedule/plannedDateGuard';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('nav.schedule');
    if (error) return error;

    const orgId = session.user.organization_id;
    const userId = session.user.id;
    const body = await req.json();

    const eventId = normalizeUuid(body.event_id);
    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json({ error: 'A valid event_id is required' }, { status: 400 });
    }

    // 1. Verify that event belongs to current organization
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId, deleted_at: null },
      select: { id: true, site_id: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Shutdown event not found or access denied' }, { status: 404 });
    }

    const siteId = event.site_id;
    const creates: any[] = Array.isArray(body.creates) ? body.creates : [];
    const updates: any[] = Array.isArray(body.updates) ? body.updates : [];
    const deletes: string[] = Array.isArray(body.deletes) ? body.deletes : [];

    // Pre-validate creates
    const validationErrors: { row: number; field: string; error: string }[] = [];
    creates.forEach((item, index) => {
      if (!item.description || !String(item.description).trim()) {
        validationErrors.push({ row: index, field: 'description', error: 'Activity description is required.' });
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed for one or more activities', details: validationErrors },
        { status: 422 }
      );
    }

    const executionUpdate = updates.find(
      (item) =>
        item.status !== undefined ||
        item.progress_percent !== undefined ||
        item.actual_start !== undefined ||
        item.actual_end !== undefined
    );
    if (executionUpdate) {
      return NextResponse.json(
        {
          error:
            'Execution-sensitive fields (status, progress, actual dates) cannot be changed through planning bulk. Use M12 ExecutionWriteService.',
        },
        { status: 409 }
      );
    }

    const plannedUpdate = updates.find((item) => listedPlannedDateFields(item).length > 0);
    if (plannedUpdate) {
      return NextResponse.json(
        { error: PLANNED_DATE_REJECT_MESSAGE, rejectedFields: listedPlannedDateFields(plannedUpdate) },
        { status: 409 }
      );
    }

    // Execute mutations inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdRecords: any[] = [];
      const updatedRecords: any[] = [];

      // 1. Process Deletions
      if (deletes.length > 0) {
        const validDeleteIds = deletes.filter((id) => isUuid(String(id)));
        if (validDeleteIds.length > 0) {
          await tx.activity.updateMany({
            where: {
              id: { in: validDeleteIds },
              organization_id: orgId,
              event_id: eventId,
            },
            data: { deleted_at: new Date() },
          });
        }
      }

      if (creates.length > 0) {
        for (const item of creates) {
          const created = await createActivity(
            {
              organizationId: orgId,
              userId,
              sourceChannel: 'bulk',
              eventId,
            },
            {
              workpackId: normalizeUuid(item.workpack_id),
              allowLoose: !normalizeUuid(item.workpack_id),
              description: String(item.description).trim(),
              activityNumber: item.activity_number ? String(item.activity_number).trim() : null,
              wbsCode: item.wbs_code ? String(item.wbs_code).trim() : null,
              disciplineId: normalizeUuid(item.discipline_id),
              discipline: item.discipline,
              durationHours: item.duration_hours !== undefined && item.duration_hours !== null ? parseFloat(item.duration_hours) : 8,
              responsible: item.responsible ? String(item.responsible).trim() : null,
              notes: item.notes ? String(item.notes).trim() : null,
              activityCode: item.activity_code,
              standardActivityTypeId: item.standard_activity_type_id,
              standardActivityType: item.standard_activity_type,
              siteId,
            },
            tx
          );
          createdRecords.push(created);
        }
      }

      // 3. Process Updates
      for (const item of updates) {
        if (!item.id || !isUuid(String(item.id))) continue;

        const data: any = { updated_at: new Date(), updated_by: userId };
        if (item.description !== undefined) data.description = String(item.description).trim();
        if (item.activity_number !== undefined) data.activity_number = item.activity_number ? String(item.activity_number).trim() : null;
        if (item.wbs_code !== undefined) data.wbs_code = item.wbs_code ? String(item.wbs_code).trim() : null;
        if (item.discipline_id !== undefined) data.discipline_id = normalizeUuid(item.discipline_id);
        if (item.workpack_id !== undefined) data.workpack_id = normalizeUuid(item.workpack_id);
        if (item.duration_hours !== undefined) data.duration_hours = item.duration_hours !== null ? parseFloat(item.duration_hours) : null;
        if (item.responsible !== undefined) data.responsible = item.responsible ? String(item.responsible).trim() : null;
        if (item.notes !== undefined) data.notes = item.notes ? String(item.notes).trim() : null;
        if (item.is_critical !== undefined) data.is_critical = Boolean(item.is_critical);

        const updated = await tx.activity.updateMany({
          where: {
            id: item.id,
            organization_id: orgId,
            event_id: eventId,
            deleted_at: null,
          },
          data,
        });

        if (updated.count > 0) {
          updatedRecords.push(item);
        }
      }

      return {
        createdCount: createdRecords.length,
        updatedCount: updatedRecords.length,
        deletedCount: deletes.length,
        created: createdRecords,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 200 });
  } catch (error: any) {
    if (error instanceof ActivityIdentityError) {
      return NextResponse.json({ error: error.message, code: error.identityCode }, { status: error.statusCode });
    }
    if (error instanceof ControlledValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[POST /api/activities/bulk] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk activities' }, { status: 500 });
  }
});
