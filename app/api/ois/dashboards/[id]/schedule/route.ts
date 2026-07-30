/**
 * M7.6C — Dashboard Schedule API
 * GET  — List schedules for a dashboard
 * POST — Create a new schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardScheduleService } from '@/core/ois';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.view');
  if (error) return error;

  const { id } = await params;
  const schedules = await DashboardScheduleService.list(id);

  return NextResponse.json({ data: schedules });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.admin');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const { id } = await params;
  const body = await req.json();

  const schedule = await DashboardScheduleService.create({
    dashboardId: id,
    organizationId: orgId,
    name: body.name,
    frequency: body.frequency,
    deliveryTime: body.deliveryTime,
    dayOfWeek: body.dayOfWeek,
    dayOfMonth: body.dayOfMonth,
    timezone: body.timezone,
    outputFormat: body.outputFormat,
    createdBy: userId,
    recipients: body.recipients ?? [],
  });

  return NextResponse.json({ data: schedule }, { status: 201 });
}
