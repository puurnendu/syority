/**
 * Generates AI shift reports for unit managers.
 * Called by cron at 8AM (day shift summary) and 8PM (night shift summary).
 */

import { prisma } from '@/lib/prisma';
import {
  callTextAi,
  loadProviderForJob,
  type ProviderConfig,
} from '@/services/ai/ProviderLoader';
import { getPromptTemplate, writeAiLog } from '@/services/ai/AiPromptService';
import { sendWhatsAppMessage } from './MetaClient';
import nodemailer from 'nodemailer';
import { generateShiftReportPdf } from '@/services/pdf/PdfGenerator';
import crypto from 'crypto';

export type ShiftType = 'day' | 'night';

export async function generateShiftReports(
  shiftType: ShiftType
): Promise<void> {
  const now = new Date();
  const shiftEnd = new Date(now);
  shiftEnd.setMinutes(0, 0, 0);

  const shiftStart = new Date(shiftEnd);
  shiftStart.setHours(shiftStart.getHours() - 12);

  const orgs = await prisma.organization.findMany({
    where: { is_active: true },
    select: { id: true, name: true },
  });

  for (const org of orgs) {
    try {
      await generateOrgShiftReports(org.id, shiftType, shiftStart, shiftEnd);
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`[ShiftReport] Org ${org.id} failed:`, err?.message);
    }
  }
}

async function generateOrgShiftReports(
  orgId: string,
  shiftType: ShiftType,
  shiftStart: Date,
  shiftEnd: Date
): Promise<void> {
  const units = await prisma.unit.findMany({
    where: {
      organization_id: orgId,
      is_active: true,
      deleted_at: null,
      shift_report_recipients: {
        some: {
          receives_shift_reports: true,
          is_active: true,
          user: {
            whatsapp_number: { not: null },
            whatsapp_opt_in: true,
          },
        },
      },
    },
    include: {
      shift_report_recipients: {
        where: {
          receives_shift_reports: true,
          is_active: true,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              whatsapp_number: true,
              whatsapp_opt_in: true,
            },
          },
        },
      },
      organization: { select: { name: true } }
    },
  });

  if (units.length === 0) return;

  let provider: ProviderConfig;
  try {
    provider = await loadProviderForJob(orgId, 'whatsapp_report');
  } catch {
    console.warn(`[ShiftReport] No AI provider for org ${orgId}`);
    return;
  }

  for (const unit of units) {
    try {
      await generateUnitShiftReport(
        unit,
        orgId,
        shiftType,
        shiftStart,
        shiftEnd,
        provider
      );
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`[ShiftReport] Unit ${unit.id} failed:`, err?.message);
    }
  }
}

async function generateUnitShiftReport(
  unit: {
    id: string;
    name: string;
    code: string | null;
    site_id: string;
    organization: { name: string };
    shift_report_recipients: Array<{
      user: {
        name: string;
        email: string;
        whatsapp_number: string | null;
        whatsapp_opt_in: boolean | null;
      };
    }>;
  },
  orgId: string,
  shiftType: ShiftType,
  shiftStart: Date,
  shiftEnd: Date,
  provider: ProviderConfig
): Promise<void> {
  const [
    completedActivities,
    overdueActivities,
    inProgressActivities,
    openConstraints,
    whatsappUpdates,
  ] = await Promise.all([
    prisma.activity.findMany({
      where: {
        workpack: {
          unit_id: unit.id,
          organization_id: orgId,
          deleted_at: null,
        },
        status: 'completed',
        updated_at: { gte: shiftStart, lte: shiftEnd },
        deleted_at: null,
      },
      select: {
        description: true,
        responsible: true,
        updated_at: true,
        workpack: {
          select: {
            workpack_number: true,
            asset: { select: { tag_number: true } },
          },
        },
      },
      take: 20,
    }),
    prisma.activity.findMany({
      where: {
        workpack: {
          unit_id: unit.id,
          organization_id: orgId,
          status: { in: ['draft', 'under_review', 'approved', 'issued'] },
          deleted_at: null,
        },
        status: { not: 'completed' },
        planned_end: { lt: shiftEnd },
        deleted_at: null,
      },
      select: {
        description: true,
        planned_end: true,
        progress_percent: true,
        workpack: {
          select: {
            workpack_number: true,
            asset: { select: { tag_number: true } },
          },
        },
      },
      take: 10,
    }),
    prisma.activity.findMany({
      where: {
        workpack: {
          unit_id: unit.id,
          organization_id: orgId,
          status: { in: ['draft', 'under_review', 'approved', 'issued'] },
          deleted_at: null,
        },
        status: 'in_progress',
        deleted_at: null,
      },
      select: {
        description: true,
        progress_percent: true,
        planned_end: true,
        workpack: {
          select: {
            workpack_number: true,
            asset: { select: { tag_number: true } },
          },
        },
      },
      take: 15,
    }),
    prisma.constraintLog.findMany({
      where: {
        workpack: {
          unit_id: unit.id,
          organization_id: orgId,
        },
        status: { not: 'resolved' },
        severity: { in: ['critical', 'high'] },
        deleted_at: null,
      },
      select: {
        title: true,
        description: true,
        severity: true,
        workpack: { select: { workpack_number: true } },
      },
      take: 5,
    }),
    prisma.whatsapp_updates.count({
      where: {
        organization_id: orgId,
        created_at: { gte: shiftStart, lte: shiftEnd },
        status: { in: ['auto_updated', 'approved_planner'] },
      },
    }),
  ]);

  const shiftLabel = shiftType === 'day' ? 'Day Shift' : 'Night Shift';
  const dateLabel = shiftStart.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeRange = `${shiftStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – ${shiftEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  const context = [
    `SHIFT: ${shiftLabel} | ${dateLabel}`,
    `TIME:  ${timeRange}`,
    `UNIT:  ${unit.name} (${unit.code ?? ''})`,
    '',
    `COMPLETED THIS SHIFT (${completedActivities.length}):`,
    ...completedActivities.map(
      (a) =>
        `  • ${(a.workpack as { asset?: { tag_number: string }; workpack_number: string })?.asset?.tag_number ?? ''} [${(a.workpack as { workpack_number: string }).workpack_number}]: ${a.description}${a.responsible ? ` (${a.responsible})` : ''}`
    ),
    '',
    `IN PROGRESS (${inProgressActivities.length}):`,
    ...inProgressActivities.map(
      (a) =>
        `  • ${(a.workpack as { asset?: { tag_number: string } }).asset?.tag_number ?? ''}: ${a.description} — ${a.progress_percent ?? 0}%${a.planned_end && a.planned_end < shiftEnd ? ' [OVERDUE]' : ''}`
    ),
    '',
    `OVERDUE ACTIVITIES (${overdueActivities.length}):`,
    ...overdueActivities.map(
      (a) =>
        `  • ${(a.workpack as { asset?: { tag_number: string } }).asset?.tag_number ?? ''}: ${a.description} — ${a.progress_percent ?? 0}% (was due ${a.planned_end ? new Date(a.planned_end).toLocaleDateString('en-GB') : 'unknown'})`
    ),
    '',
    `OPEN CONSTRAINTS (${openConstraints.length}):`,
    ...openConstraints.map(
      (c) =>
        `  • [${(c.severity ?? '').toUpperCase()}] ${c.title} (${(c.workpack as { workpack_number: string }).workpack_number})${c.description ? `: ${c.description.slice(0, 100)}` : ''}`
    ),
    '',
    `FIELD UPDATES RECEIVED: ${whatsappUpdates} (via WhatsApp, confirmed)`,
  ].join('\n');

  const template = await getPromptTemplate(orgId, 'whatsapp_report');
  const prompt = template.replace('{{context}}', context);

  const startedAt = Date.now();
  let ai;
  try {
    ai = await callTextAi(provider, prompt, 800, 0.3);
  } catch (err: any) {
    await writeAiLog({
      organization_id: orgId,
      job_type: 'whatsapp_report',
      provider: provider.provider,
      model: provider.model,
      prompt,
      latency_ms: Date.now() - startedAt,
      status: 'failed',
      error_message: err.message || String(err),
    });
    throw err;
  }

  const reportText = ai.content.trim();

  await writeAiLog({
    organization_id: orgId,
    job_type: 'whatsapp_report',
    provider: provider.provider,
    model: provider.model,
    prompt,
    response: reportText,
    tokens_input: ai.tokens_input,
    tokens_output: ai.tokens_output,
    latency_ms: Date.now() - startedAt,
    status: 'success',
  });

  const whatsappRecipients = unit.shift_report_recipients
    .filter(r => r.user.whatsapp_number && r.user.whatsapp_opt_in)
    .map(r => r.user.whatsapp_number as string);

  const emailRecipients = unit.shift_report_recipients
    .filter(r => r.user.email)
    .map(r => r.user.email);

  if (whatsappRecipients.length === 0 && emailRecipients.length === 0) return;

  const sentIds: string[] = [];
  for (const num of whatsappRecipients) {
    const msgId = await sendWhatsAppMessage(num, reportText);
    if (msgId) sentIds.push(msgId);
  }

  // Generate PDF and Send Email
  if (emailRecipients.length > 0) {
    try {
      const pdfBytes = await generateShiftReportPdf(
        unit.organization.name,
        unit.name,
        shiftType,
        dateLabel,
        reportText,
        completedActivities.length,
        overdueActivities.length,
        inProgressActivities.length
      );

      // Create a test account or use actual SMTP from process.env if available
      // Note: In production this would use process.env.SMTP_URL or similar tenant config
      let transporter;
      if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
      } else {
        // Fallback for development/testing
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
      }

      const info = await transporter.sendMail({
        from: '"SYORITY System" <reports@syority.com>',
        to: emailRecipients.join(', '),
        subject: `[${unit.name}] Shift Report: ${shiftLabel} - ${dateLabel}`,
        text: `Please find attached the shift report for ${unit.name} (${shiftLabel}).\n\nSummary:\n- Completed: ${completedActivities.length}\n- Overdue: ${overdueActivities.length}\n- In Progress: ${inProgressActivities.length}\n\nAutomated message from SYORITY.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0D2137;">${unit.name} Shift Report</h2>
            <p><strong>Shift:</strong> ${shiftLabel} | ${dateLabel}</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin-top:0;">Metrics</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li>✅ <strong>Completed:</strong> ${completedActivities.length}</li>
                <li>🚨 <strong style="color: #dc2626;">Overdue:</strong> ${overdueActivities.length}</li>
                <li>🔄 <strong style="color: #2563eb;">In Progress:</strong> ${inProgressActivities.length}</li>
              </ul>
            </div>
            <p>Please find the detailed PDF report attached.</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              Generated automatically by SYORITY AI.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: `Shift_Report_${unit.code || 'UNIT'}_${shiftType}_${new Date().toISOString().split('T')[0]}.pdf`,
            content: Buffer.from(pdfBytes),
            contentType: 'application/pdf',
          }
        ]
      });
      console.log(`[ShiftReport] Email sent to ${emailRecipients.length} recipients. MessageId: ${info.messageId}`);
    } catch (err: any) {
      console.error('[ShiftReport] Failed to send email:', err.message);
    }
  }

  await prisma.shift_reports.create({
    data: {
      id: crypto.randomUUID(),
      organization_id: orgId,
      site_id: unit.site_id,
      unit_id: unit.id,
      shift_type: shiftType,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      report_text: reportText,
      activities_completed: completedActivities.length,
      activities_overdue: overdueActivities.length,
      activities_in_progress: inProgressActivities.length,
      open_constraints_count: openConstraints.length,
      critical_constraints: openConstraints.filter(
        (c: any) => (c.severity ?? '') === 'critical'
      ).length,
      whatsapp_updates_count: whatsappUpdates,
      sent_to_numbers: [...whatsappRecipients, ...emailRecipients],
      meta_message_ids: sentIds,
      sent_at: new Date(),
      delivery_status: 'sent',
      updated_at: new Date(),
    },
  });
}
