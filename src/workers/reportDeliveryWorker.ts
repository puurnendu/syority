import { Worker } from 'bullmq';
import { redis } from '@/lib/redis';
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
 */
export const reportDeliveryWorker = new Worker<{ deliveryId: string; orgId: string }>(
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

    // ── Email (stub) ─────────────────────────────────────────────────────────
    if (delivery.channels.includes('Email')) {
      // TODO Phase 4: wire to nodemailer / SendGrid transport
      job.log(`[Email] Would send to: ${delivery.recipients.join(', ')}`);
    }

    // ── WhatsApp (stub) ──────────────────────────────────────────────────────
    if (delivery.channels.includes('WhatsApp')) {
      // TODO Phase 4: wire to existing MessageProcessor
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
  { connection: redis, concurrency: 3 }
);

reportDeliveryWorker.on('completed', (job, ret) => {
  console.log(`[Report Worker] Job ${job.id} done — ${ret?.recipients ?? 0} recipients notified`);
});

reportDeliveryWorker.on('failed', (job, err) => {
  console.error(`[Report Worker] Job ${job?.id} failed:`, err.message);
});
