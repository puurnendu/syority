/**
 * M7.6E — Alerts API
 *
 * Alert listing, lifecycle management, and commenting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlertEngine } from '@/core/bre/AlertEngine';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const id = url.searchParams.get('id');

    // Get alert counts for badges
    if (action === 'counts') {
      const counts = await AlertEngine.getCounts(session.user.organizationId);
      return NextResponse.json(counts);
    }

    // Get emergency banner
    if (action === 'emergency_banner') {
      const banner = await AlertEngine.getEmergencyBanner(session.user.organizationId);
      return NextResponse.json({ banner });
    }

    // Get meeting alerts
    if (action === 'meeting') {
      const alerts = await AlertEngine.getMeetingAlerts(session.user.organizationId);
      return NextResponse.json({ alerts });
    }

    // Get comments for an alert
    if (action === 'comments' && id) {
      const comments = await AlertEngine.getComments(id);
      return NextResponse.json({ comments });
    }

    // Get single alert
    if (id) {
      const alert = await AlertEngine.getById(id);
      return alert
        ? NextResponse.json({ alert })
        : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Parse status filter
    let statusFilter: any = url.searchParams.get('status') ?? undefined;
    if (statusFilter?.includes(',')) statusFilter = statusFilter.split(',');

    let severityFilter: any = url.searchParams.get('severity') ?? undefined;
    if (severityFilter?.includes(',')) severityFilter = severityFilter.split(',');

    // List alerts
    const alerts = await AlertEngine.list(session.user.organizationId, {
      status: statusFilter,
      severity: severityFilter,
      alertType: url.searchParams.get('type') as any ?? undefined,
      assignedTo: url.searchParams.get('assignedTo') ?? undefined,
      scopeSiteId: url.searchParams.get('siteId') ?? undefined,
      scopeUnitId: url.searchParams.get('unitId') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      limit: Number(url.searchParams.get('limit')) || 100,
      offset: Number(url.searchParams.get('offset')) || 0,
    });

    return NextResponse.json({ alerts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    switch (action) {
      case 'acknowledge':
        return NextResponse.json({ alert: await AlertEngine.acknowledge(body.id, session.user.id) });

      case 'assign':
        return NextResponse.json({ alert: await AlertEngine.assign(body.id, body.assignedTo, session.user.id) });

      case 'resolve':
        return NextResponse.json({ alert: await AlertEngine.resolve(body.id, session.user.id, body.notes) });

      case 'close':
        return NextResponse.json({ alert: await AlertEngine.close(body.id, session.user.id, body.notes) });

      case 'suppress':
        return NextResponse.json({ alert: await AlertEngine.suppress(body.id, new Date(body.until), session.user.id) });

      case 'bulk_acknowledge':
        return NextResponse.json({ count: await AlertEngine.bulkAcknowledge(body.ids, session.user.id) });

      case 'bulk_close':
        return NextResponse.json({ count: await AlertEngine.bulkClose(body.ids, session.user.id) });

      case 'comment':
        return NextResponse.json({ comment: await AlertEngine.addComment(body.id, session.user.id, body.comment) });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
