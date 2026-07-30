import { Worker } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Report delivery worker.
 *
 * Expects job.data: { deliveryId: string; orgId: string }
 *
 * Channels supported:
 *   "In-App"   — creates a Notification row (uses prisma.notification if the model exists)
 *   "Email"    — stub: log only (wire to your email transport in Phase 4)
 *   "WhatsApp" — stub: log only (wire to MessageProcessor in Phase 4)
 *
 * Created via factory — never instantiated at import time.
 */
export function createReportDeliveryWorker(): Worker<{ deliveryId: string; orgId: string }> {
  const worker = new Worker<{ deliveryId: string; orgId: string }>(
    'report-delivery',
    async (job) => {
      const { deliveryId } = job.data;

      const delivery = await prisma.scheduled_deliveries.findUniqueOrThrow({
        where: { id: deliveryId },
        include: { report_templates: true },
      });

      job.log(`Delivering report "${delivery.name}" via: ${delivery.channels.join(', ')}`);

      const errors: string[] = [];

      // ── In-App notifications ─────────────────────────────────────────────────
      if (delivery.channels.includes('In-App')) {
        for (const email of delivery.recipients) {
          try {
            const user = await prisma.user.findFirst({
              where: { email },
              select: { id: true },
            });
            if (user) {
              // Use raw query so we don't break if Notification model doesn't exist yet
              await prisma.$executeRawUnsafe(`
                INSERT INTO notifications (id, user_id, organization_id, type, title, message, read, created_at)
                VALUES (gen_random_uuid(), $1, $2, 'info', $3, $4, false, now())
                ON CONFLICT DO NOTHING
              `, user.id, delivery.organization_id,
                `Report: ${delivery.name}`,
                'Your scheduled report is ready to view in the Reporting Dashboard.');
            }
          } catch (err: any) {
            // Notification table may not exist — degrade gracefully
            job.log(`[In-App] Warning: ${err.message}`);
          }
        }
      }

      // ── Email (via Notification Platform M7.6) ─────────────────────────────
      if (delivery.channels.includes('Email')) {
        for (const email of delivery.recipients) {
          try {
            await prisma.notification_queue.create({
              data: {
                channel: 'email',
                recipient_email: email,
                subject: `Report: ${delivery.name}`,
                html_body: `<div style="font-family:Arial,sans-serif;padding:24px;"><h2>Scheduled Report: ${delivery.name}</h2><p>Your scheduled report is ready. Please log in to the Reporting Dashboard to view and download.</p></div>`,
                text_body: `Scheduled Report: ${delivery.name}\nYour scheduled report is ready. Please log in to the Reporting Dashboard to view and download.`,
                status: 'pending',
                priority: 5,
                max_attempts: 3,
                organization_id: delivery.organization_id,
                event_type: 'report.scheduled',
                entity_type: 'ScheduledDelivery',
                entity_id: deliveryId,
              },
            });
          } catch (err: any) {
            errors.push(`[Email] ${email}: ${err.message}`);
            job.log(`[Email] Error for ${email}: ${err.message}`);
          }
        }
        job.log(`[Email] Enqueued ${delivery.recipients.length} notification(s) via platform queue`);
      }

      // ── WhatsApp (stub) ──────────────────────────────────────────────────────
      if (delivery.channels.includes('WhatsApp')) {
        // TODO: wire to existing MessageProcessor
        job.log(`[WhatsApp] Would send to: ${delivery.recipients.join(', ')}`);
      }

      // ── Write delivery_logs ────────────────────────────────────────────────────
      await prisma.delivery_logs.create({
        data: {
          id:           crypto.randomUUID(),
          delivery_id:  deliveryId,
          channels:     delivery.channels,
          recipient_ct: delivery.recipients.length,
          status:       errors.length === 0 ? 'Delivered' : 'Failed',
          error:        errors.length > 0 ? errors.join('; ') : null,
        },
      });

      return { delivered: true, recipients: delivery.recipients.length };
    },
    { connection: getRedis(), concurrency: 3 }
  );

  worker.on('completed', (job, ret) => {
    console.log(`[Report Worker] Job ${job.id} done — ${ret?.recipients ?? 0} recipients notified`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Report Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
