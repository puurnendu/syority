/**
 * M7.6A — Report Schedule Service
 *
 * CRUD for scheduled reports with business-friendly frequency config.
 * Triggers report generation and feeds notification platform for delivery.
 */

import { prisma } from '@/lib/prisma';
import { ReportGenerationService, type GenerateOptions } from './ReportGenerationService';

// ─── Schedule CRUD ──────────────────────────────────────────────────────────

export class ReportScheduleService {
  /**
   * List schedules for an organization.
   */
  static async list(organizationId: string) {
    return prisma.report_schedules.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      include: {
        definition: {
          select: { id: true, name: true, slug: true, category: { select: { name: true, icon: true } } },
        },
        recipients: true,
      },
    });
  }

  /**
   * Get a single schedule.
   */
  static async getById(id: string) {
    return prisma.report_schedules.findUnique({
      where: { id },
      include: {
        definition: {
          select: { id: true, name: true, slug: true, supports_ai_summary: true, category: { select: { name: true } } },
        },
        recipients: true,
      },
    });
  }

  /**
   * Create a new schedule.
   */
  static async create(data: {
    organization_id: string;
    definition_id: string;
    name: string;
    frequency: string;
    delivery_time?: string;
    day_of_week?: number;
    day_of_month?: number;
    event_trigger?: string;
    timezone?: string;
    output_format?: string;
    layout_id?: string;
    selected_sections?: string[];
    parameters?: Record<string, any>;
    include_ai_summary?: boolean;
    subject_template?: string;
    filename_template?: string;
    created_by: string;
    recipients?: Array<{ recipient_type: string; recipient_value: string; delivery_type?: string }>;
  }) {
    const { recipients, ...scheduleData } = data;

    const schedule = await prisma.report_schedules.create({
      data: {
        ...scheduleData,
        selected_sections: data.selected_sections ?? [],
        parameters: data.parameters ?? {},
        next_run_at: ReportScheduleService.computeNextRun(data.frequency, data.delivery_time, data.day_of_week, data.day_of_month, data.timezone),
        ...(recipients?.length
          ? {
              recipients: {
                create: recipients.map((r) => ({
                  recipient_type: r.recipient_type,
                  recipient_value: r.recipient_value,
                  delivery_type: r.delivery_type ?? 'to',
                })),
              },
            }
          : {}),
      },
      include: { definition: { select: { name: true } }, recipients: true },
    });

    return schedule;
  }

  /**
   * Update a schedule.
   */
  static async update(id: string, data: Record<string, any>, updatedBy?: string) {
    const { recipients, ...rest } = data;

    // If recipients are provided, replace them
    if (recipients && Array.isArray(recipients)) {
      await prisma.report_schedule_recipients.deleteMany({ where: { schedule_id: id } });
      await prisma.report_schedule_recipients.createMany({
        data: recipients.map((r: any) => ({
          schedule_id: id,
          recipient_type: r.recipient_type,
          recipient_value: r.recipient_value,
          delivery_type: r.delivery_type ?? 'to',
        })),
      });
    }

    // Recompute next_run_at if frequency changed
    if (rest.frequency || rest.delivery_time || rest.day_of_week || rest.day_of_month) {
      const current = await prisma.report_schedules.findUnique({ where: { id } });
      rest.next_run_at = ReportScheduleService.computeNextRun(
        rest.frequency ?? current?.frequency ?? 'manual',
        rest.delivery_time ?? current?.delivery_time ?? '06:00',
        rest.day_of_week ?? current?.day_of_week,
        rest.day_of_month ?? current?.day_of_month,
        rest.timezone ?? current?.timezone ?? 'UTC'
      );
    }

    return prisma.report_schedules.update({
      where: { id },
      data: { ...rest, updated_by: updatedBy },
      include: { definition: { select: { name: true } }, recipients: true },
    });
  }

  /**
   * Delete a schedule and its recipients.
   */
  static async delete(id: string) {
    await prisma.report_schedule_recipients.deleteMany({ where: { schedule_id: id } });
    return prisma.report_schedules.delete({ where: { id } });
  }

  /**
   * Trigger a schedule immediately — generates the report and enqueues for delivery.
   */
  static async trigger(scheduleId: string): Promise<{ generationId: string; queued: number }> {
    const schedule = await prisma.report_schedules.findUniqueOrThrow({
      where: { id: scheduleId },
      include: { recipients: true, definition: true },
    });

    // 1. Generate the report
    const genOpts: GenerateOptions = {
      definitionId: schedule.definition_id,
      organizationId: schedule.organization_id,
      generatedBy: schedule.created_by,
      outputFormat: schedule.output_format as any,
      layoutId: schedule.layout_id ?? undefined,
      selectedSections: schedule.selected_sections as string[],
      parameters: schedule.parameters as Record<string, any>,
      includeAiSummary: schedule.include_ai_summary,
      scheduleId: schedule.id,
    };

    const result = await ReportGenerationService.generate(genOpts);

    if (result.status === 'failed') {
      await prisma.report_schedules.update({
        where: { id: scheduleId },
        data: { last_run_at: new Date(), last_error: result.error },
      });
      return { generationId: result.generationId, queued: 0 };
    }

    // 2. Resolve recipients and enqueue notifications
    const queueIds: string[] = [];
    for (const recipient of schedule.recipients) {
      const emails = await ReportScheduleService.resolveRecipientEmails(
        recipient.recipient_type,
        recipient.recipient_value,
        schedule.organization_id
      );

      for (const email of emails) {
        const queueItem = await prisma.notification_queue.create({
          data: {
            channel: 'email',
            recipient_email: email.email,
            recipient_name: email.name,
            subject: result.resolvedSubject ?? `Report: ${schedule.name}`,
            html_body: result.htmlContent ?? `<p>Your scheduled report "${schedule.name}" is ready.</p>`,
            text_body: `Your scheduled report "${schedule.name}" is ready.`,
            status: 'pending',
            priority: 5,
            max_attempts: 3,
            organization_id: schedule.organization_id,
            event_type: 'report.scheduled',
            entity_type: 'ReportGeneration',
            entity_id: result.generationId,
          },
        });
        queueIds.push(queueItem.id);
      }
    }

    // 3. Update generation with queue IDs
    await prisma.report_generations.update({
      where: { id: result.generationId },
      data: { notification_queue_ids: queueIds },
    });

    // 4. Update schedule state
    await prisma.report_schedules.update({
      where: { id: scheduleId },
      data: {
        last_run_at: new Date(),
        run_count: { increment: 1 },
        last_error: null,
        next_run_at: ReportScheduleService.computeNextRun(
          schedule.frequency,
          schedule.delivery_time,
          schedule.day_of_week,
          schedule.day_of_month,
          schedule.timezone
        ),
      },
    });

    return { generationId: result.generationId, queued: queueIds.length };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Resolve recipient emails from type+value.
   */
  private static async resolveRecipientEmails(
    type: string,
    value: string,
    orgId: string
  ): Promise<Array<{ email: string; name: string | null }>> {
    switch (type) {
      case 'user': {
        const user = await prisma.user.findUnique({
          where: { id: value },
          select: { email: true, name: true, is_active: true },
        });
        return user?.is_active && user.email ? [{ email: user.email, name: user.name }] : [];
      }

      case 'role': {
        const userRoles = await prisma.userRole.findMany({
          where: {
            organization_id: orgId,
            role: { slug: value },
          },
          include: { user: { select: { email: true, name: true, is_active: true } } },
        });
        return userRoles
          .filter((ur) => ur.user.is_active && ur.user.email)
          .map((ur) => ({ email: ur.user.email!, name: ur.user.name }));
      }

      case 'group': {
        const group = await prisma.notification_recipient_groups.findUnique({ where: { id: value } });
        if (!group || !group.is_active) return [];
        const members = group.members as Array<{ type: string; value: string }>;
        const results: Array<{ email: string; name: string | null }> = [];
        for (const member of members) {
          const resolved = await ReportScheduleService.resolveRecipientEmails(member.type, member.value, orgId);
          results.push(...resolved);
        }
        return results;
      }

      case 'email':
        return [{ email: value, name: null }];

      default:
        return [];
    }
  }

  /**
   * Compute the next run time from business-friendly frequency fields.
   */
  static computeNextRun(
    frequency: string,
    deliveryTime?: string | null,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
    _timezone?: string
  ): Date | null {
    const now = new Date();
    const [hours, minutes] = (deliveryTime ?? '06:00').split(':').map(Number);

    switch (frequency) {
      case 'manual':
        return null;

      case 'hourly': {
        const next = new Date(now);
        next.setMinutes(0, 0, 0);
        next.setHours(next.getHours() + 1);
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
        const targetDay = dayOfWeek ?? 1; // Monday
        const daysUntil = ((targetDay - now.getDay()) + 7) % 7 || 7;
        next.setDate(now.getDate() + daysUntil);
        next.setHours(hours, minutes, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 7);
        return next;
      }

      case 'monthly': {
        const next = new Date(now);
        const targetDay = dayOfMonth ?? 1;
        next.setDate(targetDay);
        next.setHours(hours, minutes, 0, 0);
        if (next <= now) next.setMonth(next.getMonth() + 1);
        return next;
      }

      case 'event_triggered':
        return null; // Triggered by events, not scheduled

      default:
        return null;
    }
  }
}
