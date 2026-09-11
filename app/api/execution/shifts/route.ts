import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('workpacks.view');
    if (error) return error;

    const orgId = session.user.organization_id;
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id');
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    // Retrieve safety/shift logs for event
    const logs = await prisma.safetyLog.findMany({
      where: {
        ...(eventId ? { event_id: eventId } : {}),
      },
      orderBy: { log_date: 'desc' },
      take: 10,
    });

    return NextResponse.json({ data: logs });
  } catch (err: any) {
    console.error('[API Shifts GET] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('workpacks.edit');
    if (error) return error;

    const orgId = session.user.organization_id;
    const userId = session.user.id;
    const body = await req.json();

    const { event_id, log_date, shift, manpower_actual, manhours_worked, ptw_issued, toolbox_talks, safety_notes, action } = body;

    if (!event_id || !log_date) {
      return NextResponse.json({ error: 'event_id and log_date are required' }, { status: 400 });
    }

    const dateObj = new Date(log_date);

    // Check if shift record exists
    let existing = await prisma.safetyLog.findFirst({
      where: { event_id, log_date: dateObj },
    });

    if (existing) {
      const updated = await prisma.safetyLog.update({
        where: { id: existing.id },
        data: {
          shift: shift || existing.shift,
          manpower_actual: manpower_actual !== undefined ? Number(manpower_actual) : existing.manpower_actual,
          manhours_worked: manhours_worked !== undefined ? Number(manhours_worked) : existing.manhours_worked,
          ptw_issued: ptw_issued !== undefined ? Number(ptw_issued) : existing.ptw_issued,
          toolbox_talks: toolbox_talks !== undefined ? Number(toolbox_talks) : existing.toolbox_talks,
          safety_notes: safety_notes !== undefined ? safety_notes : existing.safety_notes,
          last_updated_by: userId,
          last_updated_by_name: (session.user as any).name || 'Supervisor',
        },
      });
      return NextResponse.json({ data: updated, action: 'updated' });
    }

    const created = await prisma.safetyLog.create({
      data: {
        id: crypto.randomUUID(),
        event_id,
        log_date: dateObj,
        shift: shift || 'day',
        manpower_planned: manpower_actual ? Number(manpower_actual) : 40,
        manpower_actual: manpower_actual ? Number(manpower_actual) : 40,
        manhours_worked: manhours_worked ? Number(manhours_worked) : 360,
        manhours_planned: manhours_worked ? Number(manhours_worked) : 360,
        ptw_issued: ptw_issued ? Number(ptw_issued) : 0,
        toolbox_talks: toolbox_talks ? Number(toolbox_talks) : 1,
        safety_notes: safety_notes || 'Shift opened by field supervisor',
        submitted_by: userId,
        submitted_by_name: (session.user as any).name || 'Supervisor',
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ data: created, action: 'created' }, { status: 201 });
  } catch (err: any) {
    console.error('[API Shifts POST] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
