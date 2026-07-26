import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_STATUSES = [
  'not_submitted',
  'submitted',
  'approved',
  'rejected',
  'revision_requested',
] as const;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }
    const { id } = await context.params;

    const workpack = await prisma.workpack.findFirst({
      where: {
        id,
        organization_id: orgId,
        deleted_at: null,
      },
      select: {
        id: true,
        approval_status: true,
        approval_submitted_at: true,
        approval_decided_at: true,
        approved_by_name: true,
        approved_by_email: true,
        approval_notes: true,
      },
    });

    if (!workpack) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(workpack);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body?.approval_status) {
      return NextResponse.json(
        { error: 'approval_status required' },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(body.approval_status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.workpack.findFirst({
      where: {
        id,
        organization_id: orgId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const now = new Date();
    const isDecision = ['approved', 'rejected', 'revision_requested'].includes(
      body.approval_status
    );

    const updated = await prisma.workpack.update({
      where: { id },
      data: {
        approval_status: body.approval_status,
        approved_by_name: body.approved_by_name ?? null,
        approved_by_email: body.approved_by_email ?? null,
        approval_notes: body.approval_notes ?? null,
        ...(body.approval_status === 'submitted' && {
          approval_submitted_at: now,
        }),
        ...(isDecision && {
          approval_decided_at: now,
        }),
      },
      select: {
        id: true,
        approval_status: true,
        approval_submitted_at: true,
        approval_decided_at: true,
        approved_by_name: true,
        approved_by_email: true,
        approval_notes: true,
      },
    });

    await prisma.auditLog
      .create({
        data: {
          organization_id: orgId,
          auditable_type: 'workpack',
          auditable_id: id,
          event: 'workpack.approval_status_changed',
          new_values: {
            new_status: body.approval_status,
            approved_by: body.approved_by_name,
          } as object,
          user_id: session.user.id,
        },
      })
      .catch(() => null);

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('[approval PATCH]', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
