/**
 * M7.6C — Dashboard Schedule Service
 *
 * Manages scheduled dashboard delivery.
 * Reuses the existing Notification Platform for email delivery.
 * No new scheduling logic — delegates to NotificationQueueProcessor.
 */

import { prisma } from '@/lib/prisma';
import { DashboardSnapshotService } from './DashboardSnapshotService';
import { processEvent } from '@/core/notifications';
import type { ScheduleFrequency, ExportFormat } from './WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateScheduleInput {
  dashboardId: string;
  organizationId: string;
  name: string;
  frequency: ScheduleFrequency;
  deliveryTime?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  outputFormat?: ExportFormat;
  createdBy: string;
  recipients: Array<{
    recipientType: string;
    recipientValue: string;
    deliveryType?: string;
  }>;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class DashboardScheduleService {

  /**
   * Create a new schedule for dashboard delivery.
   */
  static async create(input: CreateScheduleInput) {
    const schedule = await prisma.ois_dashboard_schedules.create({
      data: {
        dashboard_id: input.dashboardId,
        organization_id: input.organizationId,
        name: input.name,
        frequency: input.frequency,
        delivery_time: input.deliveryTime ?? '06:00',
        day_of_week: input.dayOfWeek,
        day_of_month: input.dayOfMonth,
        timezone: input.timezone ?? 'UTC',
        output_format: input.outputFormat ?? 'pdf',
        next_run_at: DashboardScheduleService.computeNextRun(
          input.frequency,
          input.deliveryTime ?? '06:00',
          input.dayOfWeek,
          input.dayOfMonth,
          input.timezone ?? 'UTC',
        ),
        created_by: input.createdBy,
      },
    });

    // Add recipients
    if (input.recipients.length > 0) {
      await prisma.ois_dashboard_schedule_recipients.createMany({
        data: input.recipients.map((r) => ({
          schedule_id: schedule.id,
          recipient_type: r.recipientType,
          recipient_value: r.recipientValue,
          delivery_type: r.deliveryType ?? 'to',
        })),
      });
    }

    return schedule;
  }

  /**
   * List schedules for a dashboard.
   */
  static async list(dashboardId: string) {
    return prisma.ois_dashboard_schedules.findMany({
      where: { dashboard_id: dashboardId },
      include: { recipients: true },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Toggle schedule active/inactive.
   */
  static async toggle(scheduleId: string, isActive: boolean, userId: string) {
    return prisma.ois_dashboard_schedules.update({
      where: { id: scheduleId },
      data: { is_active: isActive, updated_by: userId },
    });
  }

  /**
   * Delete a schedule.
   */
  static async delete(scheduleId: string) {
    return prisma.ois_dashboard_schedules.delete({ where: { id: scheduleId } });
  }

  /**
   * Execute a scheduled delivery.
   * Called by the scheduler/cron job.
   * 1. Generate snapshot
   * 2. Queue notification via existing Notification Platform
   * 3. Update schedule timestamps
   */
  static async execute(scheduleId: string) {
    const schedule = await prisma.ois_dashboard_schedules.findUniqueOrThrow({
      where: { id: scheduleId },
      include: {
        recipients: true,
        dashboard: { select: { name: true, slug: true } },
      },
    });

    try {
      // 1. Generate snapshot
      const snapshot = await DashboardSnapshotService.generate({
        dashboardId: schedule.dashboard_id,
        organizationId: schedule.organization_id,
        outputFormat: schedule.output_format as ExportFormat,
        generatedBy: schedule.created_by,
      });

      // 2. Queue notification using existing Notification Platform
      const recipientEmails = schedule.recipients
        .filter((r) => r.recipient_type === 'email')
        .map((r) => r.recipient_value);

      if (recipientEmails.length > 0) {
        await processEvent({
          eventType: 'dashboard.scheduled_delivery',
          orgId: schedule.organization_id,
          userId: schedule.created_by,
          data: {
            dashboardName: schedule.dashboard.name,
            snapshotId: snapshot.snapshotId,
            filename: snapshot.filename,
            outputFormat: schedule.output_format,
            recipientEmails,
          },
        });
      }

      // 3. Update schedule
      const nextRun = DashboardScheduleService.computeNextRun(
        schedule.frequency as ScheduleFrequency,
        schedule.delivery_time ?? '06:00',
        schedule.day_of_week ?? undefined,
        schedule.day_of_month ?? undefined,
        schedule.timezone,
      );

      await prisma.ois_dashboard_schedules.update({
        where: { id: scheduleId },
        data: {
          last_run_at: new Date(),
          next_run_at: nextRun,
          run_count: { increment: 1 },
          last_error: null,
        },
      });

      return { success: true, snapshotId: snapshot.snapshotId };
    } catch (err: any) {
      await prisma.ois_dashboard_schedules.update({
        where: { id: scheduleId },
        data: {
          last_run_at: new Date(),
          last_error: err.message,
        },
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Find schedules due for execution.
   */
  static async findDueSchedules() {
    return prisma.ois_dashboard_schedules.findMany({
      where: {
        is_active: true,
        next_run_at: { lte: new Date() },
      },
      include: { dashboard: { select: { name: true } } },
      orderBy: { next_run_at: 'asc' },
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private static computeNextRun(
    frequency: ScheduleFrequency,
    deliveryTime: string,
    dayOfWeek?: number,
    dayOfMonth?: number,
    _timezone?: string,
  ): Date | null {
    const now = new Date();
    const [hours, minutes] = deliveryTime.split(':').map(Number);

    switch (frequency) {
      case 'hourly': {
        const next = new Date(now);
        next.setMinutes(minutes, 0, 0);
        if (next <= now) next.setHours(next.getHours() + 1);
        return next;
      }
      case 'daily': {
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        return next;
      }
      case 'weekly': {
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        const targetDay = dayOfWeek ?? 1; // Default Monday
        const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
        return next;
      }
      case 'monthly': {
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        next.setDate(dayOfMonth ?? 1);
        if (next <= now) next.setMonth(next.getMonth() + 1);
        return next;
      }
      case 'manual':
      case 'event_triggered':
      default:
        return null;
    }
  }
}
