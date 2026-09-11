import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { reportDeliveryQueue } from '@/lib/queues';

/**
 * GET  /api/reporting/deliveries   — list deliveries with last DeliveryLog
 * POST /api/reporting/deliveries   — create + enqueue to reportDeliveryQueue
 */
export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const deliveries = await prisma.scheduled_deliveries.findMany({
    where: { organization_id: session.user.organization_id },
    orderBy: { created_at: 'desc' },
    include: {
      report_templates: { select: { id: true, name: true } },
      delivery_logs: { orderBy: { sent_at: 'desc' }, take: 1 },
    },
  });

  return NextResponse.json({ deliveries });
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const body = await req.json();
  const { name, template_id, recipients, channels, frequency, delivery_time } = body ?? {};

  if (!name || !template_id || !recipients?.length || !channels?.length || !frequency) {
    return NextResponse.json({ error: 'Missing required fields: name, template_id, recipients, channels, frequency' }, { status: 400 });
  }

  // Verify template belongs to org
  const template = await prisma.report_templates.findFirst({
    where: { id: template_id, organization_id: session.user.organization_id, deleted_at: null },
  });
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const delivery = await prisma.scheduled_deliveries.create({
    data: {
      organization_id: session.user.organization_id,
      name,
      template_id,
      recipients,
      channels,
      frequency,
      delivery_time: delivery_time ?? '06:00',
      active: true,
      created_by: session.user.id,
    },
  });

  // Enqueue immediately if "On Demand"
  if (frequency === 'On Demand') {
    await reportDeliveryQueue.add(
      'deliver',
      { deliveryId: delivery.id, orgId: session.user.organization_id },
      { removeOnComplete: 50 }
    );
  }

  return NextResponse.json({ delivery, queued: frequency === 'On Demand' }, { status: 201 });
});
