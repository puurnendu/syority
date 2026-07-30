/**
 * NotificationQueueProcessor — Processes pending notification queue items.
 *
 * Picks pending items from the notification_queue table, delivers them
 * via the configured provider, and logs the results.
 *
 * Can be called by:
 * 1. BullMQ worker (notification-delivery queue)
 * 2. API endpoint (manual trigger)
 * 3. Cron job
 */

import { prisma } from '@/lib/prisma';
import { deliverEmail } from './NotificationDeliveryService';
import { logger } from '@/lib/logger';

// ─── Queue Processing ──────────────────────────────────────────────────────────

/**
 * Process a batch of pending notification queue items.
 *
 * @param batchSize - Number of items to process per batch (default: 20)
 * @returns Number of items processed
 */
export async function processQueue(batchSize = 20): Promise<number> {
  const now = new Date();

  // Pick pending items that are due for sending
  const items = await prisma.notification_queue.findMany({
    where: {
      status: { in: ['pending', 'retrying'] },
      OR: [
        { scheduled_for: null },
        { scheduled_for: { lte: now } },
      ],
    },
    orderBy: [{ priority: 'asc' }, { created_at: 'asc' }],
    take: batchSize,
  });

  if (items.length === 0) return 0;

  let processed = 0;

  for (const item of items) {
    try {
      // Mark as sending
      await prisma.notification_queue.update({
        where: { id: item.id },
        data: {
          status: 'sending',
          attempts: item.attempts + 1,
        },
      });

      if (item.channel !== 'email') {
        // Future: handle SMS, WhatsApp, etc.
        await prisma.notification_queue.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            last_error: `Channel "${item.channel}" not yet supported`,
          },
        });

        await createDeliveryLog(item, {
          status: 'failed',
          failureReason: `Channel "${item.channel}" not yet supported`,
          attempts: item.attempts + 1,
        });

        processed++;
        continue;
      }

      // Deliver via email
      const result = await deliverEmail(
        {
          to: item.recipient_email!,
          toName: item.recipient_name ?? undefined,
          subject: item.subject,
          html: item.html_body,
          text: item.text_body ?? undefined,
          attachments: parseAttachments(item.attachments),
        },
        item.provider_id ?? undefined
      );

      if (result.success) {
        // Mark as sent
        await prisma.notification_queue.update({
          where: { id: item.id },
          data: {
            status: 'sent',
            sent_at: new Date(),
            smtp_response: result.smtpResponse ?? null,
            last_error: null,
          },
        });

        await createDeliveryLog(item, {
          status: 'sent',
          messageId: result.messageId,
          smtpResponse: result.smtpResponse,
          attempts: item.attempts + 1,
          providerName: result.providerName,
        });
      } else {
        // Check if we should retry
        const shouldRetry = item.attempts + 1 < item.max_attempts;

        await prisma.notification_queue.update({
          where: { id: item.id },
          data: {
            status: shouldRetry ? 'retrying' : 'failed',
            last_error: result.error ?? 'Unknown error',
            // Exponential backoff: schedule retry for later
            ...(shouldRetry && {
              scheduled_for: new Date(Date.now() + (item.attempts + 1) * 30000),
            }),
          },
        });

        if (!shouldRetry) {
          await createDeliveryLog(item, {
            status: 'failed',
            failureReason: result.error,
            attempts: item.attempts + 1,
          });
        }
      }

      processed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('QueueProcessor', `Failed to process queue item`, {
        itemId: item.id,
        error: msg,
      });

      await prisma.notification_queue.update({
        where: { id: item.id },
        data: {
          status: item.attempts + 1 < item.max_attempts ? 'retrying' : 'failed',
          last_error: msg,
        },
      }).catch(() => null);

      processed++;
    }
  }

  if (processed > 0) {
    logger.info('QueueProcessor', `Processed ${processed} queue item(s)`);
  }

  return processed;
}

/**
 * Cancel a queued notification.
 */
export async function cancelQueueItem(itemId: string): Promise<void> {
  const item = await prisma.notification_queue.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Queue item not found');
  if (item.status === 'sent' || item.status === 'delivered') {
    throw new Error('Cannot cancel a notification that has already been sent');
  }

  await prisma.notification_queue.update({
    where: { id: itemId },
    data: { status: 'cancelled' },
  });

  logger.info('QueueProcessor', `Cancelled queue item`, { itemId });
}

/**
 * Retry a failed notification.
 */
export async function retryQueueItem(itemId: string): Promise<void> {
  const item = await prisma.notification_queue.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Queue item not found');
  if (item.status !== 'failed' && item.status !== 'cancelled') {
    throw new Error('Can only retry failed or cancelled notifications');
  }

  await prisma.notification_queue.update({
    where: { id: itemId },
    data: {
      status: 'pending',
      attempts: 0,
      last_error: null,
      scheduled_for: null,
    },
  });

  logger.info('QueueProcessor', `Retried queue item`, { itemId });
}

/**
 * Get queue statistics.
 */
export async function getQueueStats() {
  const [pending, sending, sent, failed, retrying, cancelled] = await Promise.all([
    prisma.notification_queue.count({ where: { status: 'pending' } }),
    prisma.notification_queue.count({ where: { status: 'sending' } }),
    prisma.notification_queue.count({ where: { status: 'sent' } }),
    prisma.notification_queue.count({ where: { status: 'failed' } }),
    prisma.notification_queue.count({ where: { status: 'retrying' } }),
    prisma.notification_queue.count({ where: { status: 'cancelled' } }),
  ]);

  return { pending, sending, sent, failed, retrying, cancelled, total: pending + sending + sent + failed + retrying + cancelled };
}

/**
 * List queue items with pagination and filtering.
 */
export async function listQueueItems(options?: {
  status?: string;
  limit?: number;
  offset?: number;
  organization_id?: string;
}) {
  const where: Record<string, unknown> = {};
  if (options?.status) where.status = options.status;
  if (options?.organization_id) where.organization_id = options.organization_id;

  const [items, total] = await Promise.all([
    prisma.notification_queue.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
      include: {
        template: { select: { name: true, slug: true } },
        provider: { select: { name: true } },
      },
    }),
    prisma.notification_queue.count({ where }),
  ]);

  return { items, total };
}

// ─── Dashboard Statistics ──────────────────────────────────────────────────────

/**
 * Get notification dashboard statistics.
 */
export async function getDashboardStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    sentToday,
    failedToday,
    pendingCount,
    queueLength,
    totalSent,
    totalFailed,
    recentErrors,
    topTemplates,
  ] = await Promise.all([
    // Sent today
    prisma.notification_delivery_logs.count({
      where: { status: 'sent', sent_at: { gte: todayStart } },
    }),
    // Failed today
    prisma.notification_delivery_logs.count({
      where: { status: 'failed', sent_at: { gte: todayStart } },
    }),
    // Pending in queue
    prisma.notification_queue.count({
      where: { status: { in: ['pending', 'retrying'] } },
    }),
    // Total queue length
    prisma.notification_queue.count({
      where: { status: { in: ['pending', 'sending', 'retrying'] } },
    }),
    // Total sent all time
    prisma.notification_delivery_logs.count({
      where: { status: 'sent' },
    }),
    // Total failed all time
    prisma.notification_delivery_logs.count({
      where: { status: 'failed' },
    }),
    // Last 10 errors
    prisma.notification_delivery_logs.findMany({
      where: { status: 'failed' },
      orderBy: { sent_at: 'desc' },
      take: 10,
      select: {
        id: true,
        recipient_email: true,
        subject: true,
        failure_reason: true,
        sent_at: true,
        event_type: true,
      },
    }),
    // Top templates (by usage in last 30 days)
    prisma.notification_delivery_logs.groupBy({
      by: ['template_id'],
      where: {
        sent_at: { gte: new Date(Date.now() - 30 * 86400000) },
        template_id: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ]);

  // Resolve template names for top templates
  const templateIds = topTemplates.map((t) => t.template_id).filter(Boolean) as string[];
  const templates = templateIds.length > 0
    ? await prisma.notification_templates.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true },
      })
    : [];
  const templateNameMap = new Map(templates.map((t) => [t.id, t.name]));

  return {
    sentToday,
    failedToday,
    pendingCount,
    queueLength,
    totalSent,
    totalFailed,
    recentErrors,
    topTemplates: topTemplates.map((t) => ({
      templateId: t.template_id,
      templateName: t.template_id ? templateNameMap.get(t.template_id) ?? 'Unknown' : 'Unknown',
      count: t._count.id,
    })),
  };
}

// ─── Delivery Log ──────────────────────────────────────────────────────────────

/**
 * List delivery logs with pagination.
 */
export async function listDeliveryLogs(options?: {
  status?: string;
  limit?: number;
  offset?: number;
  organization_id?: string;
  event_type?: string;
  recipient_email?: string;
}) {
  const where: Record<string, unknown> = {};
  if (options?.status) where.status = options.status;
  if (options?.organization_id) where.organization_id = options.organization_id;
  if (options?.event_type) where.event_type = options.event_type;
  if (options?.recipient_email) where.recipient_email = { contains: options.recipient_email, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.notification_delivery_logs.findMany({
      where,
      orderBy: { sent_at: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
      include: {
        template: { select: { name: true, slug: true } },
        provider: { select: { name: true } },
      },
    }),
    prisma.notification_delivery_logs.count({ where }),
  ]);

  return { items, total };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseAttachments(attachments: unknown): Array<{ filename: string; content: Buffer | string; contentType?: string }> | undefined {
  if (!attachments || !Array.isArray(attachments)) return undefined;
  return (attachments as Array<{ filename: string; content_base64?: string; mime_type?: string }>).map((a) => ({
    filename: a.filename,
    content: a.content_base64 ? Buffer.from(a.content_base64, 'base64') : '',
    contentType: a.mime_type,
  }));
}

async function createDeliveryLog(
  item: {
    id: string;
    provider_id: string | null;
    template_id: string | null;
    channel: string;
    recipient_email: string | null;
    recipient_name: string | null;
    subject: string;
    organization_id: string | null;
    event_type: string | null;
    entity_type: string | null;
    entity_id: string | null;
    attachments: unknown;
  },
  result: {
    status: string;
    messageId?: string;
    smtpResponse?: string;
    failureReason?: string;
    attempts: number;
    providerName?: string;
  }
): Promise<void> {
  try {
    await prisma.notification_delivery_logs.create({
      data: {
        queue_item_id: item.id,
        provider_id: item.provider_id,
        template_id: item.template_id,
        channel: item.channel,
        recipient_email: item.recipient_email,
        recipient_name: item.recipient_name,
        subject: item.subject,
        status: result.status,
        attempts: result.attempts,
        smtp_response: result.smtpResponse ?? null,
        message_id: result.messageId ?? null,
        failure_reason: result.failureReason ?? null,
        has_attachments: Array.isArray(item.attachments) && (item.attachments as unknown[]).length > 0,
        organization_id: item.organization_id,
        event_type: item.event_type,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        // 90-day retention by default
        expires_at: new Date(Date.now() + 90 * 86400000),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('QueueProcessor', 'Failed to create delivery log', { error: msg });
  }
}
